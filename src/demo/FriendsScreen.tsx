import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Popup } from './Popup';
import { playClick } from '../audio/sounds';
import { Card, PrimaryButton, SecondaryButton } from '../ui/Card';
import { Confirm, Tell } from '../ui/Confirm';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { TrophyIcon } from '../ui/Icon';
import { DiceSwatch } from './DiceSwatch';
import { ARENAS } from '../arena/arenas';
import { skinById } from '../game/diceSkins';
import { MODES, MODE_ORDER } from '../game/modes';
import {
  formatFriendCode,
  normaliseFriendCode,
  typedFriendCode,
} from '../game/friendCodes';
import { inviteMessage, inviteUrl } from '../game/inviteLink';
import type { Identity } from '../game/playerIdentity';
import type { PublicProfile } from '../game/friends';
import type { ChallengeState } from '../game/battlesApi';
import {
  canBattleFriend,
  FRIENDLY_MODES,
  MODE_NOT_READY,
  secondsLeft,
} from '../game/friendlyBattle';
import { AI_DIFFICULTIES, AiDifficultyId } from '../game/ai';
import type { ModeId } from '../game/modes';
import { MODE_ICONS } from '../ui/modeIcons';
import {
  actOnFriend,
  EMPTY_LIST,
  FriendList,
  fetchFriends,
  findByCode,
  isCodeTaken,
  ProfilePeek,
  pushProfile,
} from '../game/friendsApi';
import { refreshName, replaceFriendCode } from '../game/playerIdentity';
import { nextPollDelay, sameList } from '../game/friendsPoll';
import { recallFriends, rememberFriends } from '../game/friendsCache';
import { loadFriends } from '../game/friendsLoad';
import { useAppActive } from '../game/useAppActive';

/**
 * Friends, and their profiles.
 *
 * David asked for this on 3 Sep 2026 as "an account system and a friends
 * system". There is deliberately NO account: no sign-up, no email, no
 * password, no age. Identity comes from Game Center, so Apple holds it
 * and already has the parent's consent — which is the only way a game
 * rated 4+ can have friends at all without a consent flow of its own and
 * a new App Privacy filing.
 *
 * FINDING SOMEBODY IS BY CODE, not by search. There is no directory and
 * no "people you may know": a child cannot be found by anyone who was
 * not handed their code. That is a deliberate limit, not a missing
 * feature — and it is also forced, because expo-game-center 1.0.1 does
 * not expose Apple's friends list.
 */

type Page = 'list' | 'profile';

/**
 * Turn the one server error a player can actually hit into English.
 *
 * "wrong secret" means this phone is asking about a profile it cannot
 * prove it owns, and there is exactly one ordinary way to arrive there:
 * the game was deleted and installed again, and the keychain copy of the
 * secret did not survive with it. Apple does not promise it will (see
 * deviceVault.ts), so this is the honest end of that road rather than a
 * fault to report.
 *
 * Said plainly, and without blaming them or pretending it is temporary —
 * "Try again" cannot fix this one, and telling somebody to retry
 * something that can never work is worse than telling them the truth.
 */
function explain(error: string): { text: string; retryable: boolean } {
  if (/wrong secret/i.test(error)) {
    return {
      text:
        'This phone was set up fresh, so it cannot get back into the ' +
        'profile it had before. Your new code is above — ask your friends ' +
        'to add you with it, and everything you have unlocked is still here.',
      retryable: false,
    };
  }
  return { text: error, retryable: true };
}

/** Everything a profile shows about me. Gathered by the caller, which
 *  is the screen that already holds the game's state. */
export type MyStats = Parameters<typeof pushProfile>[1];

export function FriendsScreen({
  me,
  stats,
  onClose,
  challenges,
  onChallenge,
  onAnswer,
  invite,
  onInviteHandled,
}: {
  me: Identity;
  stats: MyStats;
  onClose: () => void;
  /*
    Challenges come from the SCREEN ABOVE, not from here.

    The banner has to be able to appear while somebody is rolling dice
    with this panel shut, so the asking has to happen where the game
    lives. Two pollers would be two timers asking the same question and
    two answers that could disagree about whether a challenge is still
    alive.
  */
  challenges: ChallengeState;
  onChallenge: (
    friend: PublicProfile,
    mode: ModeId,
    difficulty: AiDifficultyId,
  ) => Promise<string | null>;
  onAnswer: (inviteId: string, action: 'accept' | 'decline' | 'cancel') => void;
  /*
    A friend code that arrived from a LINK somebody tapped, rather than
    one typed into the box.

    It comes from the screen above because a link can land while the
    game is on the dice, or while it is not running at all — see
    DiceDemoScreen, which is where the URL is caught. All this screen
    does is the part that needs a friends list in front of it: look the
    code up and ask.
  */
  invite?: string | null;
  /** Said once the question has been asked, so it is not asked twice. */
  onInviteHandled?: () => void;
}) {
  /*
    My own identity, held here rather than read from the prop.

    Two things can change it while this screen is open: Game Center
    finishing its sign-in and handing over a real name, and a friend
    code that had to be redrawn because the server said it was taken.
    Reading the prop would leave the card showing a code the server has
    never heard of.
  */
  const [who, setWho] = useState<Identity>(me);
  /** False until the first poll cycle has been set up. See below. */
  const started = useRef(false);
  /** True while refresh() is in flight, so a poll cannot overtake it. */
  const refreshing = useRef(false);
  /*
    The list this player was last shown, if the tab has been open before
    in this session — so reopening it draws the friends immediately
    instead of a spinner. It is re-read either way; this only fills the
    gap before the answer lands. See friendsCache.ts.

    `loading` is false whenever there is something to show, INCLUDING an
    empty list: "you have no friends yet" is an answer, and making
    somebody watch a spinner before repeating it to them is the same
    wait this is meant to remove.
  */
  const [list, setList] = useState<FriendList>(() => recallFriends(me.playerId) ?? EMPTY_LIST);
  const [loading, setLoading] = useState(() => recallFriends(me.playerId) === null);
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<ProfilePeek | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [showing, setShowing] = useState<PublicProfile | null>(null);
  /*
    Cutting somebody off is the one thing here that cannot be undone by
    tapping again — a block can only be lifted from the blocked list,
    and a removed friend has to ask all over again. So both ask first.
  */
  /*
    The friend a challenge is being set up for, and what it will be.

    Held here rather than on each row: only one can be open at a time,
    and the picker replaces the row it belongs to rather than pushing
    seventy rows around underneath it.
  */
  const [challenging, setChallenging] = useState<PublicProfile | null>(null);
  const [battleMode, setBattleMode] = useState<ModeId>('classic');
  const [battleDifficulty, setBattleDifficulty] = useState<AiDifficultyId>('easy');
  const [sending, setSending] = useState(false);
  const [challengeNote, setChallengeNote] = useState<string | null>(null);
  /** Redrawn once a second, so the countdowns actually count. */
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [asking, setAsking] = useState<
    { action: 'remove' | 'block' | 'unblock'; playerId: string; name: string } | null
  >(null);
  /*
    An action that fails from the profile page used to fail in silence:
    `problem` is drawn on the LIST, which is the page you are not
    looking at. This one is drawn over whatever page you are on.
  */
  const [actionError, setActionError] = useState<string | null>(null);
  /*
    Somebody a link says I should add: the profile once it is looked up,
    or a plain sentence when there is nothing to ask about.
  */
  const [inviting, setInviting] = useState<ProfilePeek | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const page: Page = showing ? 'profile' : 'list';

  /**
   * Re-read everything.
   *
   * `waiting` puts the spinner up first, and only one caller wants it:
   * the "Try again" button under an error. Opening the screen does not,
   * because there may be a remembered list to show meanwhile, and
   * finishing an action does not, because the list is already on screen
   * and blanking it would be a worse answer than a second of staleness.
   *
   * It used to be unconditional, which was invisible while refresh was
   * also the only way the list ever arrived. With the list now drawn
   * from the cache the moment the screen opens, an unconditional spinner
   * would throw away the very thing this change added — and dropping it
   * entirely would leave "Try again" looking like a dead button.
   */
  const refresh = useCallback(
    async (waiting = false) => {
      refreshing.current = true;
      if (waiting) {
        setProblem(null);
        setLoading(true);
      }

      /*
        The sequence itself lives in friendsLoad.ts, where the suite can
        run it. What is left here is what only a screen can do: put the
        list up the instant it arrives, and remember it for the next
        time the tab is opened.

        THE `finally` IS LOAD-BEARING. `refreshing.current` is what stops
        the four-second poll from overtaking this, and if it were ever
        left true the poll would stop for good and the list would go back
        to being frozen until the tab was reopened — the exact bug
        v1.84.0 fixed. Nothing called here is supposed to throw, but
        "supposed to" is not a guarantee worth a dead friends list.
      */
      try {
        const { who: mine, problem } = await loadFriends(
          me,
          {
            read: fetchFriends,
            name: refreshName,
            publish: (id) => pushProfile(id, stats),
            reissueCode: replaceFriendCode,
            codeTaken: isCodeTaken,
          },
          (fresh) => {
            setList(fresh);
            rememberFriends(me.playerId, fresh);
            setProblem(null);
            setLoading(false);
          },
        );
        setWho(mine);
        setProblem(problem);
      } finally {
        setLoading(false);
        refreshing.current = false;
      }
    },
    [me, stats],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /*
    KEEP LOOKING, while somebody is actually looking.

    David, 10 Sep 2026: "when I send a friend request, it should update on
    my phone in the friends tab immediately when the other person accepts
    it and so I don't have to close the friends tab and reopen it." Until
    now the list was fetched once, on open, and nothing ever changed it
    again — so an accepted request appeared only if you left the screen
    and came back.

    A quiet re-read rather than `refresh()`: no spinner, no republishing
    of my own profile, and the list is left exactly as it was if the
    answer has not changed (sameList) so the rows do not re-render under
    the player every few seconds.

    Stops when the app leaves the foreground, and stops when this screen
    unmounts. That is the rule v1.69.0 set for every repeating timer
    here, and a friends list polling from inside a pocket is precisely
    what that release was about.
  */
  const appActive = useAppActive();
  const busy = useRef(false);
  const failures = useRef(0);

  const poll = useCallback(async () => {
    /*
      One at a time, and never while a full refresh is in flight. A poll
      that overtook a refresh would put the older answer on screen — for
      four seconds, which is long enough to see.
    */
    if (busy.current || refreshing.current) return;
    busy.current = true;
    try {
      const result = await fetchFriends(who);
      if (result.ok) {
        failures.current = 0;
        // Remembered on every poll, not only on open: the cache is only
        // worth having if what it holds is the newest answer seen.
        rememberFriends(who.playerId, result.list);
        setList((current) => (sameList(current, result.list) ? current : result.list));
      } else {
        /*
          A failed poll is deliberately SILENT. The list on screen is
          still the last true answer, and replacing it with an error
          because one background check missed would be a worse screen
          than a slightly stale one. The backoff is the response.
        */
        failures.current += 1;
      }
    } finally {
      busy.current = false;
    }
  }, [who]);

  useEffect(() => {
    if (!appActive) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    /*
      Coming back from the background asks straight away — that is the
      moment most likely to have news waiting. The very first run after
      mount does not, because refresh() has just fetched the same thing.
    */
    const immediate = started.current;
    started.current = true;

    const tick = async () => {
      await poll();
      if (!alive) return;
      timer = setTimeout(tick, nextPollDelay(failures.current));
    };
    timer = setTimeout(tick, immediate ? 0 : nextPollDelay(failures.current));
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [appActive, poll]);

  const search = async () => {
    const clean = normaliseFriendCode(code);
    if (!clean) {
      setSearchNote('A code is eight letters and numbers.');
      setFound(null);
      return;
    }
    if (clean === who.friendCode) {
      setSearchNote('That is your own code!');
      setFound(null);
      return;
    }
    setSearching(true);
    setSearchNote(null);
    const result = await findByCode(clean);
    setSearching(false);
    if (!result.ok) {
      setSearchNote(result.error);
      return;
    }
    if (!result.profile) {
      setSearchNote('Nobody has that code.');
      setFound(null);
      return;
    }
    setFound(result.profile);
  };

  const act = async (otherId: string, action: Parameters<typeof actOnFriend>[2]) => {
    const result = await actOnFriend(who, otherId, action);
    if (!result.ok) {
      setProblem(result.error);
      setActionError(result.error);
      return;
    }
    /*
      Say so. After "Ask to be friends" the card simply vanished and the
      typed code cleared, which is exactly what a failure looks like too
      — and the other person sees nothing until they next play, so there
      was no other confirmation coming.
    */
    setSearchNote(
      action === 'request' ? 'Asked! They will see it next time they play.' : null,
    );
    setFound(null);
    setCode('');
    setShowing(null);
    await refresh();
  };

  /**
   * Hand my code to somebody, through the sheet the phone already has.
   *
   * David, 17 Sep 2026: "like when you go to share a video with someone
   * and it gives you all those options in a pop up". That is
   * `Share.share`, which is React Native's own wrapper around
   * UIActivityViewController — no new dependency, no native module, so
   * it goes out over the air like any other change.
   *
   * THE MESSAGE AND THE URL ARE PASSED SEPARATELY, and that is the
   * whole trick behind the picture David asked for. iOS hands each one
   * to the chosen app as its own item, and Messages only draws its rich
   * card — the logo, the title — for an item that is a URL on its own.
   * Fold the link into the message string and what sends is a wall of
   * blue text with no picture in it. The message still ends with the
   * link as well, for the apps that take only one item.
   *
   * NOTHING HERE IS ALLOWED TO THROW. Share.share REJECTS when somebody
   * swipes the sheet away, which is the most ordinary thing a person
   * can do with it, and an unhandled rejection in a screen is a red box
   * over a game.
   */
  const shareCode = async () => {
    playClick();
    try {
      await Share.share({
        message: inviteMessage(who.name, who.friendCode),
        url: inviteUrl(who.friendCode),
      });
    } catch {
      // Dismissed, or no sheet to show. Either way there is nothing to
      // tell anybody: they are looking at the code already.
    }
  };

  /*
    A code that came from a tapped link.

    Looked up rather than trusted: the link carries eight characters and
    nothing else, so the name in the question has to come from the
    server. Everything that is not a question to ask becomes a plain
    sentence instead — "that is your own code", "you two are already
    friends" — because a link that silently does nothing looks broken
    to the person who tapped it.

    `onInviteHandled` fires in every branch, including the ones that
    ask nothing. Leaving the code set would re-run this on the next
    render for ever.
  */
  /*
    The callback held in a ref, and the effect below depending on the
    ref rather than on the callback.

    `onInviteHandled={() => setInvite(null)}` is a NEW function on every
    render of the screen above — which re-renders on a one-second timer
    for the battle countdowns. An effect depending on it would therefore
    re-run about once a second, meaning a fresh `findByCode` every
    second for as long as an invite was pending, and a confirmation that
    reopened itself the moment it was dismissed.
  */
  const inviteHandled = useRef(onInviteHandled);
  inviteHandled.current = onInviteHandled;

  useEffect(() => {
    if (!invite) return;
    let alive = true;
    void (async () => {
      const clean = normaliseFriendCode(invite);
      const done = () => {
        if (alive) inviteHandled.current?.();
      };
      if (!clean) {
        setInviteNote('That invite link was not a friend code.');
        return done();
      }
      if (clean === who.friendCode) {
        setInviteNote('That link has your own code in it! Send it to somebody else.');
        return done();
      }
      const result = await findByCode(clean);
      if (!alive) return;
      if (!result.ok) {
        setInviteNote(result.error);
        return done();
      }
      if (!result.profile) {
        setInviteNote('Nobody has that code. Ask them to share it again.');
        return done();
      }
      /*
        The already-friends check goes AFTER the lookup, and matches on
        the player id rather than the code, because a friend's profile
        does not carry a code: /api/friends deliberately leaves
        friend_code out of what it selects, so that a list of friends is
        not also a list of codes that would let anyone holding it add
        them. `f.friendCode` here would be undefined for every row and
        this branch would never once fire.
      */
      const profile = result.profile;
      const already = list.friends.find((f) => f.playerId === profile.playerId);
      if (already) {
        setInviteNote(`You and ${already.name} are already friends.`);
        return done();
      }
      setInviting(profile);
      done();
    })();
    return () => {
      alive = false;
    };
    // `list` is deliberately absent: it changes on every poll, and this
    // must not re-ask the moment a refresh lands. The friends check is a
    // courtesy on whatever list is in hand when the link arrives; the
    // server refuses a duplicate request anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, who.friendCode]);

  /*
    The question, and the error, drawn over whichever page is showing —
    the list and the profile are two returns below, and a confirmation
    that only existed on one of them would be the bug all over again.
  */
  const ASK_COPY = {
    remove: {
      title: (n: string) => `Remove ${n}?`,
      body: 'They come off your list and you come off theirs. Either of you can ask again afterwards.',
      confirm: 'Yes, remove them',
    },
    block: {
      title: (n: string) => `Block ${n}?`,
      body: 'They cannot ask to be your friend again, and they are not told. You can undo this from the blocked list at the bottom of this page.',
      confirm: 'Yes, block them',
    },
    unblock: {
      title: (n: string) => `Unblock ${n}?`,
      body: 'They will be able to ask to be your friend again. They were never told they were blocked.',
      confirm: 'Yes, unblock them',
    },
  } as const;

  const overlays = (
    <>
      {asking && (
        <Confirm
          title={ASK_COPY[asking.action].title(asking.name)}
          body={ASK_COPY[asking.action].body}
          confirmLabel={ASK_COPY[asking.action].confirm}
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            const a = asking;
            setAsking(null);
            void act(a.playerId, a.action);
          }}
        />
      )}
      {actionError && (
        <Tell
          title="That did not go through"
          body={actionError}
          dismissLabel="Close"
          onDismiss={() => setActionError(null)}
        />
      )}
      {/*
        The question a tapped link asks. Drawn beside the others so it
        appears over the profile page too — a link can land while
        somebody is reading a friend's card.

        It ASKS. A link that added a friend on its own would mean anyone
        who could get a URL in front of a child could put themselves on
        their friends list, and no convenience is worth that.
      */}
      {inviting && (
        <Confirm
          title={`Add ${inviting.name}?`}
          body={`${inviting.name} shared their code with you. They will show up on your friends list once they say yes.`}
          confirmLabel="Yes, ask to be friends"
          cancelLabel="No thanks"
          onCancel={() => setInviting(null)}
          onConfirm={() => {
            const them = inviting;
            setInviting(null);
            void act(them.playerId, 'request');
          }}
        />
      )}
      {inviteNote && (
        <Tell
          title="About that link"
          body={inviteNote}
          dismissLabel="Close"
          onDismiss={() => setInviteNote(null)}
        />
      )}
    </>
  );

  if (page === 'profile' && showing) {
    return (
      <>
        {/*
          The profile is a second page INSIDE the same popup — the title
          becomes the friend's name so it is obvious whose page this is,
          and the ✕ still leaves Friends altogether.
        */}
        <Popup title={showing.name} onClose={onClose}>
          <ProfileView
            profile={showing}
            onBack={() => setShowing(null)}
            onRemove={() =>
              setAsking({ action: 'remove', playerId: showing.playerId, name: showing.name })
            }
            onBlock={() =>
              setAsking({ action: 'block', playerId: showing.playerId, name: showing.name })
            }
          />
        </Popup>
        {/*
          OUTSIDE the popup, deliberately. Confirm fills its PARENT, and
          the popup's panel clips with overflow:hidden — rendered inside
          it, "Remove this friend?" would have been squeezed into the
          panel and cut off rather than covering the screen. That is the
          whole reason the popup is built here rather than wrapped around
          this component by the caller.
        */}
        {overlays}
      </>
    );
  }

  /*
    A POPUP, not a page, since 10 Sep 2026 — David asked for it to behave
    like Settings and News.

    So the frame is gone: no absolute page box, no title of its own, and
    no back button. `Popup` supplies all three, plus the two ways out it
    guarantees (the ✕ and a tap on the dim around the panel), and the
    game stays visible behind it so it is obvious you have not gone
    anywhere. The old "‹ Back" existed because the tab bar was drawn over
    this page and would have swallowed a tap near the bottom; a popup is
    drawn above the bar and dims it, so that problem is gone with it.
  */
  return (
    <>
      <Popup title="Friends" onClose={onClose}>
        {/*
          The friend-code box sits partway down this panel, and on a
          phone the keyboard would cover the very thing being typed
          into — the same fault the Settings code box had, fixed the
          same way: the panel gives up the keyboard's height so the
          list scrolls into what is left of the view.
        */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView contentContainerStyle={styles.scroll}>

        {/*
          Said before the code, not after it, because it is the reason
          the code is the one they already know. Without this a player
          who has just reinstalled has no way of telling whether the
          eight letters in front of them are their old ones.
        */}
        {who.recovered && (
          <Card style={styles.recoveredCard} background={THEME.sunk} drop={0}>
            <Text style={styles.recoveredTitle}>Welcome back</Text>
            <Text style={styles.recoveredBody}>
              This phone had your profile from before, so your friend code
              is the same one and your friends are still your friends.
            </Text>
          </Card>
        )}

        {/*
          CHALLENGES FIRST, above everything.

          David asked for these to appear "at the top of the friends tab
          with the option to accept or decline" as well as on the banner.
          The two are the same list seen twice on purpose: the banner is
          gone in a few seconds and this one stays for as long as the
          challenge does, so somebody who was mid-roll when it slid past
          has not lost it.
        */}
        {challenges.incoming.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>WANTS A BATTLE</Text>
            {challenges.incoming.map((c) => (
              <Card key={c.id} style={styles.rowCard} background={THEME.gold} drop={SHAPE.drop}>
                <Text style={styles.rowName}>{c.who?.name ?? 'A friend'}</Text>
                <Text style={styles.note}>
                  {MODES[c.mode].name} · {AI_DIFFICULTIES[c.difficulty].label} · no trophies ·{' '}
                  {secondsLeft(c.expiresAt, tick)}s left
                </Text>
                <View style={styles.rowActions}>
                  <SecondaryButton
                    style={styles.smallButton}
                    onPress={() => onAnswer(c.id, 'decline')}
                  >
                    <Text style={styles.smallSecondaryText}>No thanks</Text>
                  </SecondaryButton>
                  <PrimaryButton
                    style={styles.smallButton}
                    onPress={() => onAnswer(c.id, 'accept')}
                  >
                    <Text style={styles.smallButtonText}>Battle!</Text>
                  </PrimaryButton>
                </View>
              </Card>
            ))}
          </>
        )}

        {challenges.outgoing && (
          <>
            <Text style={styles.sectionTitle}>WAITING ON THEM</Text>
            <Card style={styles.rowCard}>
              <Text style={styles.note}>
                Asked {challenges.outgoing.who?.name ?? 'them'} for a{' '}
                {MODES[challenges.outgoing.mode].name} battle.{' '}
                {secondsLeft(challenges.outgoing.expiresAt, tick)}s left to answer.
              </Text>
              <SecondaryButton
                style={styles.smallButton}
                onPress={() => onAnswer(challenges.outgoing!.id, 'cancel')}
              >
                <Text style={styles.smallSecondaryText}>Cancel</Text>
              </SecondaryButton>
            </Card>
          </>
        )}

        {/* Your own code, big enough to read out to somebody. */}
        <Card style={styles.meCard}>
          <Text style={styles.meLabel}>YOUR FRIEND CODE</Text>
          <Text style={styles.meCode} selectable>
            {formatFriendCode(who.friendCode)}
          </Text>
          <Text style={styles.meNote}>
            {/*
              It used to say the code "goes with your Game Center
              account", which was never true: your profile is proved by
              a secret kept on this phone, so it cannot follow you to
              another one whoever you are signed in as. Saying so.
            */}
            Give this to someone so they can add you. It lives on this
            phone.
          </Text>
          {/*
            Reading eight characters down a phone line still works and
            is still the fallback, but David asked on 17 Sep 2026 for
            the ordinary way: the share sheet, a written message, and a
            link that drops whoever taps it into the question.
          */}
          {/*
            The stretch is on a WRAPPER, not on the button.

            `alignSelf: 'stretch'` passed to PrimaryButton does nothing
            at all: Card puts the style it is handed on its inner face
            view, while the thing this card's `alignItems: 'center'`
            actually lays out is the Pressable wrapped around it. The
            button came out shrink-wrapped with the words touching both
            edges — seen in tools/duo-preview, not reasoned about.
          */}
          <View style={styles.shareRow}>
            <PrimaryButton style={styles.shareButton} onPress={() => void shareCode()}>
              <Text style={styles.shareText}>Share my code</Text>
            </PrimaryButton>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>ADD A FRIEND</Text>
        <Card style={styles.addCard}>
          <TextInput
            style={styles.input}
            value={code}
            // The dash puts itself in — see typedFriendCode.
            onChangeText={(text) => setCode(typedFriendCode(text))}
            placeholder="Their code, like K7M2-9XPQ"
            placeholderTextColor={THEME.inkFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            // Eight characters and the one dash between them.
            maxLength={9}
          />
          {found ? (
            <View style={styles.foundRow}>
              <View style={styles.foundWho}>
                <Text style={styles.foundName}>{found.name}</Text>
                <View style={styles.trophyRow}>
                  <TrophyIcon size={12} color={THEME.inkFaint} />
                  <Text style={styles.trophyText}>{found.trophies}</Text>
                </View>
              </View>
              <PrimaryButton
                style={styles.askButton}
                onPress={() => act(found.playerId, 'request')}
              >
                <Text style={styles.askText}>Ask to be friends</Text>
              </PrimaryButton>
            </View>
          ) : (
            <PrimaryButton style={styles.askButton} onPress={searching ? undefined : search}>
              {searching ? (
                <ActivityIndicator color={THEME.onAccent} />
              ) : (
                <Text style={styles.askText}>Find them</Text>
              )}
            </PrimaryButton>
          )}
          {searchNote && <Text style={styles.note}>{searchNote}</Text>}
        </Card>

        {list.requests.filter((r) => r.incoming).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>WANTS TO BE YOUR FRIEND</Text>
            {list.requests
              .filter((r) => r.incoming)
              .map((r) => (
                <Card key={r.playerId} style={styles.rowCard}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  <View style={styles.rowActions}>
                    <PrimaryButton
                      style={styles.smallButton}
                      onPress={() => act(r.playerId, 'accept')}
                    >
                      <Text style={styles.smallButtonText}>Yes</Text>
                    </PrimaryButton>
                    <SecondaryButton
                      style={styles.smallButton}
                      onPress={() => act(r.playerId, 'decline')}
                    >
                      <Text style={styles.smallSecondaryText}>No</Text>
                    </SecondaryButton>
                  </View>
                </Card>
              ))}
          </>
        )}

        {list.requests.filter((r) => !r.incoming).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>WAITING FOR AN ANSWER</Text>
            {list.requests
              .filter((r) => !r.incoming)
              .map((r) => (
                <Card key={r.playerId} style={styles.rowCard}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  <SecondaryButton
                    style={styles.smallButton}
                    onPress={() => act(r.playerId, 'cancel')}
                  >
                    <Text style={styles.smallSecondaryText}>Cancel</Text>
                  </SecondaryButton>
                </Card>
              ))}
          </>
        )}

        <Text style={styles.sectionTitle}>YOUR FRIENDS</Text>
        {loading ? (
          <ActivityIndicator color={THEME.ink} style={styles.spinner} />
        ) : problem ? (
          <Card style={styles.rowCard}>
            <Text style={styles.note}>{explain(problem).text}</Text>
            {explain(problem).retryable && (
              <SecondaryButton style={styles.smallButton} onPress={() => void refresh(true)}>
                <Text style={styles.smallSecondaryText}>Try again</Text>
              </SecondaryButton>
            )}
          </Card>
        ) : list.friends.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nobody yet. Give someone your code and they can add you.
            </Text>
          </Card>
        ) : (
          list.friends.map((friend) =>
            challenging?.playerId === friend.playerId ? (
              <BattlePicker
                key={friend.playerId}
                friend={friend}
                mode={battleMode}
                difficulty={battleDifficulty}
                sending={sending}
                note={challengeNote}
                onMode={setBattleMode}
                onDifficulty={setBattleDifficulty}
                onCancel={() => {
                  setChallenging(null);
                  setChallengeNote(null);
                }}
                onSend={async () => {
                  setSending(true);
                  setChallengeNote(null);
                  const error = await onChallenge(friend, battleMode, battleDifficulty);
                  setSending(false);
                  if (error) {
                    setChallengeNote(error);
                    return;
                  }
                  setChallenging(null);
                }}
              />
            ) : (
              <Card
                key={friend.playerId}
                style={styles.friendCard}
                onPress={() => setShowing(friend)}
              >
                <DiceSwatch skin={skinById(friend.favouriteDie)} size={44} />
                <View style={styles.friendWho}>
                  <Text style={styles.rowName}>{friend.name}</Text>
                  <View style={styles.trophyRow}>
                    <TrophyIcon size={12} color={THEME.inkFaint} />
                    <Text style={styles.trophyText}>{friend.trophies}</Text>
                  </View>
                </View>
                {/*
                  Its own button rather than a choice inside their
                  profile page: challenging somebody is the thing you
                  came to this list to do, and burying it one tap deeper
                  is how the Friends tab itself got moved in v1.74.0.
                */}
                <Pressable
                  style={styles.battleButton}
                  onPress={() => {
                    playClick();
                    setChallengeNote(null);
                    setChallenging(friend);
                  }}
                >
                  <Text style={styles.battleButtonText}>Battle</Text>
                </Pressable>
                <Text style={styles.chevron}>›</Text>
              </Card>
            ),
          )
        )}

        {/*
          The way back out of a block. The rule engine has always said
          unblock is the ONLY move a blocked row allows, and until now
          there was nowhere in the game to make it — so a mis-tap on
          Block was permanent.
        */}
        {list.blocked.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>BLOCKED</Text>
            <Text style={styles.blockedNote}>
              They cannot ask to be your friend, and they were never told.
            </Text>
            {list.blocked.map((b) => (
              <Card key={b.playerId} style={styles.rowCard}>
                <Text style={styles.rowName}>{b.name}</Text>
                <SecondaryButton
                  style={styles.smallButton}
                  onPress={() =>
                    setAsking({ action: 'unblock', playerId: b.playerId, name: b.name })
                  }
                >
                  <Text style={styles.smallSecondaryText}>Unblock</Text>
                </SecondaryButton>
              </Card>
            ))}
          </>
        )}
        </ScrollView>
        </KeyboardAvoidingView>
      </Popup>
      {overlays}
    </>
  );
}

/**
 * Choosing what a friendly battle will be, in the row the friend was in.
 *
 * David asked: "when you click to initiate the battle it should give you
 * the option to choose the game mode and difficulty."
 *
 * IN PLACE, not in a dialog. The list can be long, and a modal over it
 * loses which friend you were looking at — the picker takes the row's
 * place so the name stays in front of you the whole time.
 *
 * Only the modes that can honestly be played against a real person are
 * offered, and the ones that cannot say why rather than being silently
 * absent. See FRIENDLY_MODES in game/friendlyBattle.ts.
 */
function BattlePicker({
  friend,
  mode,
  difficulty,
  sending,
  note,
  onMode,
  onDifficulty,
  onSend,
  onCancel,
}: {
  friend: PublicProfile;
  mode: ModeId;
  difficulty: AiDifficultyId;
  sending: boolean;
  note: string | null;
  onMode: (m: ModeId) => void;
  onDifficulty: (d: AiDifficultyId) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  const missing = MODE_ORDER.filter((m) => !canBattleFriend(m));
  return (
    <Card style={styles.pickerCard}>
      <Text style={styles.rowName}>Battle {friend.name}</Text>
      <Text style={styles.note}>
        A friendly battle. No trophies and no coins either way — see who wins.
      </Text>

      <Text style={styles.sectionTitle}>MODE</Text>
      <View style={styles.pickerRow}>
        {FRIENDLY_MODES.map((id) => {
          const Icon = MODE_ICONS[id];
          const on = id === mode;
          return (
            <Pressable
              key={id}
              style={[styles.pickerChip, on && styles.pickerChipOn]}
              onPress={() => {
                playClick();
                onMode(id);
              }}
            >
              <Icon size={20} />
              <Text style={[styles.pickerChipText, on && styles.pickerChipTextOn]}>
                {MODES[id].name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {missing.map((id) => (
        <Text key={id} style={styles.pickerWhy}>
          {MODES[id].name} is not here yet. {MODE_NOT_READY[id]}
        </Text>
      ))}

      <Text style={styles.sectionTitle}>BATTLEFIELD</Text>
      <View style={styles.pickerRow}>
        {(Object.keys(AI_DIFFICULTIES) as AiDifficultyId[]).map((id) => {
          const on = id === difficulty;
          return (
            <Pressable
              key={id}
              style={[styles.pickerChip, on && styles.pickerChipOn]}
              onPress={() => {
                playClick();
                onDifficulty(id);
              }}
            >
              <Text style={[styles.pickerChipText, on && styles.pickerChipTextOn]}>
                {AI_DIFFICULTIES[id].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {note && <Text style={styles.note}>{note}</Text>}

      <View style={styles.rowActions}>
        <SecondaryButton style={styles.smallButton} onPress={onCancel}>
          <Text style={styles.smallSecondaryText}>Not now</Text>
        </SecondaryButton>
        {/*
          Guarded by the handler rather than a `disabled` prop: the
          shared PrimaryButton does not take one, and adding it for this
          one caller would change a component every screen uses.
        */}
        <PrimaryButton style={styles.smallButton} onPress={() => !sending && onSend()}>
          <Text style={styles.smallButtonText}>
            {sending ? 'Asking…' : 'Ask them'}
          </Text>
        </PrimaryButton>
      </View>
    </Card>
  );
}

/** One friend, in full. Only ever reached for somebody who IS a friend. */
function ProfileView({
  profile,
  onBack,
  onRemove,
  onBlock,
}: {
  profile: PublicProfile;
  onBack: () => void;
  onRemove: () => void;
  onBlock: () => void;
}) {
  const arena = ARENAS[profile.favouriteArena as keyof typeof ARENAS];
  const totalWins =
    (profile.wins?.easy ?? 0) + (profile.wins?.medium ?? 0) + (profile.wins?.hard ?? 0);

  /*
    Inside the popup too, so it keeps its own "‹ Friends" — that one is
    not a way OUT of Friends, it is the way back to the list, and the
    popup's ✕ is what leaves entirely. Two different exits doing two
    different things, which is why this one stayed when the list's went.
  */
  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ Friends</Text>
        </Pressable>

        <Card style={styles.profileHead}>
          <DiceSwatch skin={skinById(profile.favouriteDie)} size={72} />
          <Text style={styles.profileName}>{profile.name}</Text>
          <View style={styles.trophyRow}>
            <TrophyIcon size={16} color={THEME.ink} />
            <Text style={styles.profileTrophies}>{profile.trophies}</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>BATTLES WON</Text>
        <Card style={styles.statCard}>
          <Stat label="All together" value={totalWins} />
          <Stat label="Against Easy" value={profile.wins?.easy ?? 0} />
          <Stat label="Against Medium" value={profile.wins?.medium ?? 0} />
          <Stat label="Against Hard" value={profile.wins?.hard ?? 0} />
        </Card>

        <Text style={styles.sectionTitle}>WAYS THEY PLAY</Text>
        <Card style={styles.statCard}>
          {MODE_ORDER.map((mode) => (
            <Stat key={mode} label={MODES[mode].name} value={profile.modeWins?.[mode] ?? 0} />
          ))}
        </Card>

        <Text style={styles.sectionTitle}>WHAT THEY HAVE</Text>
        <Card style={styles.statCard}>
          <Stat label="Dice sets" value={profile.diceOwned} />
          <Stat label="Battlefields" value={profile.arenasOwned} />
          <Stat label="Favourite battlefield" text={arena?.name ?? 'Castle Courtyard'} />
        </Card>

        <View style={styles.profileActions}>
          <SecondaryButton style={styles.wideButton} onPress={onRemove}>
            <Text style={styles.smallSecondaryText}>Remove friend</Text>
          </SecondaryButton>
          <SecondaryButton style={styles.wideButton} onPress={onBlock}>
            <Text style={styles.blockText}>Block</Text>
          </SecondaryButton>
        </View>
        <Text style={styles.blockNote}>
          Blocking is quiet. They are not told, and they cannot ask again.
        </Text>
      </ScrollView>
    </>
  );
}

function Stat({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{text ?? value ?? 0}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  title: { ...TYPE.title, color: THEME.ink, marginBottom: 14 },

  recoveredCard: { padding: 14, marginBottom: 10 },
  recoveredTitle: { ...TYPE.cardTitle, color: THEME.ink, marginBottom: 3 },
  recoveredBody: {
    ...TYPE.small,
    color: THEME.inkSoft,
    fontWeight: '600',
    lineHeight: 17,
  },
  meCard: { padding: 16, alignItems: 'center' },
  meLabel: { ...TYPE.label, color: THEME.inkFaint, letterSpacing: 1 },
  meCode: {
    ...TYPE.display,
    fontSize: 34,
    color: THEME.ink,
    marginTop: 6,
    letterSpacing: 2,
  },
  meNote: { ...TYPE.small, color: THEME.inkSoft, textAlign: 'center', marginTop: 8 },
  // Full width of the card, because it is the thing on this card
  // a thumb is meant to land on.
  shareRow: { alignSelf: 'stretch', marginTop: 14 },
  shareButton: { paddingVertical: 12 },
  shareText: { ...TYPE.cardTitle, color: THEME.onAccent },

  sectionTitle: {
    ...TYPE.label,
    color: THEME.inkFaint,
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 8,
  },
  addCard: { padding: 14 },
  input: {
    backgroundColor: THEME.sunk,
    borderRadius: SHAPE.radiusSm,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    color: THEME.ink,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    padding: 12,
    marginBottom: 12,
  },
  askButton: { paddingVertical: 12 },
  askText: { ...TYPE.cardTitle, color: THEME.onAccent },
  note: { ...TYPE.small, color: THEME.inkSoft, textAlign: 'center', marginTop: 10 },

  foundRow: { gap: 10 },
  foundWho: { alignItems: 'center', gap: 4 },
  foundName: { ...TYPE.heading, color: THEME.ink },

  rowCard: { padding: 14, gap: 10 },
  rowName: { ...TYPE.cardTitle, color: THEME.ink },
  rowActions: { flexDirection: 'row', gap: 10 },
  smallButton: { flex: 1, paddingVertical: 10 },
  smallButtonText: { ...TYPE.body, color: THEME.onAccent },
  smallSecondaryText: { ...TYPE.body, color: THEME.ink },

  emptyCard: { padding: 18 },
  emptyText: { ...TYPE.body, color: THEME.inkSoft, textAlign: 'center' },
  spinner: { marginTop: 16 },

  friendCard: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  battleButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: SHAPE.radius - 6,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    backgroundColor: THEME.gold,
  },
  battleButtonText: { color: THEME.ink, fontSize: 13, fontWeight: '800' },
  pickerCard: { padding: 14, gap: 10, marginBottom: 10 },
  pickerRow: { flexDirection: 'row', gap: 8 },
  pickerChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: SHAPE.radius - 6,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    backgroundColor: THEME.surface,
  },
  pickerChipOn: { backgroundColor: THEME.gold },
  pickerChipText: { color: THEME.inkSoft, fontSize: 12, fontWeight: '800' },
  pickerChipTextOn: { color: THEME.ink },
  pickerWhy: { color: THEME.inkFaint, fontSize: 11.5, fontWeight: '600' },
  friendWho: { flex: 1, gap: 3 },
  trophyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trophyText: { ...TYPE.small, color: THEME.inkFaint },
  chevron: { fontSize: 24, color: THEME.inkFaint, fontWeight: '700' },

  back: { paddingVertical: 6, marginBottom: 6 },
  backText: { ...TYPE.cardTitle, color: THEME.ink },
  profileHead: { padding: 20, alignItems: 'center', gap: 8 },
  profileName: { ...TYPE.title, fontSize: 26, color: THEME.ink },
  profileTrophies: { ...TYPE.heading, color: THEME.ink },

  statCard: { padding: 14, gap: 2 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statLabel: { ...TYPE.body, color: THEME.inkSoft },
  statValue: { ...TYPE.body, color: THEME.ink, fontVariant: ['tabular-nums'] },

  profileActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  wideButton: { flex: 1, paddingVertical: 12 },
  blockText: { ...TYPE.body, color: THEME.bad },
  blockedNote: {
    ...TYPE.small,
    color: THEME.inkFaint,
    marginTop: -4,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  blockNote: { ...TYPE.small, color: THEME.inkFaint, textAlign: 'center', marginTop: 10 },
});

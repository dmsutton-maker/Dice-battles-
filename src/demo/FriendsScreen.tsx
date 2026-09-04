import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MENU_PAGE_AREA } from './BottomNav';
import { Card, PrimaryButton, SecondaryButton } from '../ui/Card';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { TrophyIcon } from '../ui/Icon';
import { DiceSwatch } from './DiceSwatch';
import { ARENAS } from '../arena/arenas';
import { skinById } from '../game/diceSkins';
import { MODES, MODE_ORDER } from '../game/modes';
import { formatFriendCode, normaliseFriendCode } from '../game/friendCodes';
import type { Identity } from '../game/playerIdentity';
import type { PublicProfile } from '../game/friends';
import {
  actOnFriend,
  EMPTY_LIST,
  FriendList,
  fetchFriends,
  findByCode,
  ProfilePeek,
} from '../game/friendsApi';

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

export function FriendsScreen({ me, onClose }: { me: Identity; onClose: () => void }) {
  const [list, setList] = useState<FriendList>(EMPTY_LIST);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<ProfilePeek | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [showing, setShowing] = useState<PublicProfile | null>(null);
  const page: Page = showing ? 'profile' : 'list';

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchFriends(me);
    if (result.ok) {
      setList(result.list);
      setProblem(null);
    } else {
      setProblem(result.error);
    }
    setLoading(false);
  }, [me]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const search = async () => {
    const clean = normaliseFriendCode(code);
    if (!clean) {
      setSearchNote('A code is eight letters and numbers.');
      setFound(null);
      return;
    }
    if (clean === me.friendCode) {
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
    const result = await actOnFriend(me, otherId, action);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setFound(null);
    setCode('');
    setShowing(null);
    await refresh();
  };

  if (page === 'profile' && showing) {
    return (
      <ProfileView
        profile={showing}
        onBack={() => setShowing(null)}
        onRemove={() => act(showing.playerId, 'remove')}
        onBlock={() => act(showing.playerId, 'block')}
      />
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/*
          A real way out. The tab bar is drawn over this page and would
          take a tap meant for anything near the bottom, so the exit
          goes at the TOP — the same lesson the menu pages learned when
          their Done buttons sat invisible under the bar.
        */}
        <Pressable onPress={onClose} style={styles.back}>
          <Text style={styles.backText}>‹ Ranks</Text>
        </Pressable>
        <Text style={styles.title}>Friends</Text>

        {/* Your own code, big enough to read out to somebody. */}
        <Card style={styles.meCard}>
          <Text style={styles.meLabel}>YOUR FRIEND CODE</Text>
          <Text style={styles.meCode} selectable>
            {formatFriendCode(me.friendCode)}
          </Text>
          <Text style={styles.meNote}>
            Give this to someone so they can add you. {me.portable
              ? 'It goes with your Game Center account.'
              : 'It lives on this phone — sign in to Game Center to keep it if you change phones.'}
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>ADD A FRIEND</Text>
        <Card style={styles.addCard}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Their code, like K7M2-9XPQ"
            placeholderTextColor={THEME.inkFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
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
            <Text style={styles.note}>{problem}</Text>
            <SecondaryButton style={styles.smallButton} onPress={() => void refresh()}>
              <Text style={styles.smallSecondaryText}>Try again</Text>
            </SecondaryButton>
          </Card>
        ) : list.friends.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nobody yet. Give someone your code and they can add you.
            </Text>
          </Card>
        ) : (
          list.friends.map((friend) => (
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
              <Text style={styles.chevron}>›</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
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

  return (
    <View style={styles.page}>
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
    </View>
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
  page: { ...MENU_PAGE_AREA, backgroundColor: THEME.ground, zIndex: 20, paddingTop: 100 },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  title: { ...TYPE.title, color: THEME.ink, marginBottom: 14 },

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
  blockNote: { ...TYPE.small, color: THEME.inkFaint, textAlign: 'center', marginTop: 10 },
});

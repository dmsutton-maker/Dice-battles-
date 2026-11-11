import type { Highlight, QA } from './content';

/**
 * Vector Faces, our Apple Watch app: everything the website says about it,
 * in one place.
 *
 * Its page (/apps/vector-faces) shows all of it, and the Support page shows
 * the first three FAQ answers from this same list. One list, so a question
 * is answered once and the two pages can never answer it differently: the
 * rule the admin already keeps for Dice Battles' FAQ.
 *
 * This copy lives in code, not in the admin: there are no `vector_faces.*`
 * content keys and no editor for them yet.
 */

/** The one-sentence version, for the Games page card. */
export const VECTOR_FACES_SUMMARY =
  'Retro, glowing vector watch faces: 37 animated faces, live flights, rain radar, the sky above you and two little characters. One purchase, every face.';

/** Shorter again, for the card on the home page. */
export const VECTOR_FACES_TAGLINE = 'Retro, glowing watch faces for Apple Watch';

export const VECTOR_FACES_DESCRIPTION =
  'Retro, glowing vector watch faces for Apple Watch: 37 animated faces drawn in lines of light, like old radar screens, cockpit displays and arcade cabinets. Every face shows the date, the weather, your battery and the time to the second.';

/** The claim badges under the title. Promises about the app: keep them true. */
export const VECTOR_FACES_PILLS = ['One purchase', 'No subscriptions', 'No tracking'];

export const VECTOR_FACES_HIGHLIGHTS: Highlight[] = [
  {
    title: 'Live flights and rain radar',
    body: "The Flights face shows the real aircraft round you on a radar scope, with each one's flight and altitude. Rain Radar plays the last 45 minutes of the weather radar where you are (United States).",
  },
  {
    title: 'The sky above you',
    body: "Sunrise and sunset, the moon's phase, the planets and the stars, all worked out on the watch for where you are.",
  },
  {
    title: 'Make it yours',
    body: "Tap a face to change its colors. Choose what each corner shows: weather, today's high and low, rain, sunrise, the moon, steps, heart rate, your next event, a second time zone or a countdown.",
  },
  {
    title: 'One purchase, every face',
    body: 'Buy it once and every face is yours, including new faces as they arrive in free updates. No subscriptions, no in-app purchases, no ads.',
  },
];

/** The Support page shows the first three, so the most-asked go first. */
export const VECTOR_FACES_FAQ: QA[] = [
  {
    q: 'How do I keep it on screen?',
    a: 'On your watch open Settings, then General, then Return to Clock, and choose After 1 hour (newer versions of watchOS let you set this for Vector Faces alone). An hour is the longest Apple lets any app stay up; after that the watch shows its own face again.',
  },
  {
    q: 'How do I get back to it quickly?',
    a: 'Add a Vector Faces complication to your regular watch face: press and hold the face, tap Edit, swipe to the complications, pick a spot and choose Vector Faces. There are six: open the app, open a face you choose, a mini dial, the weather, the sun and the moon. One tap takes you back.',
  },
  {
    q: 'Does it work without my iPhone?',
    a: 'Yes. The faces run on the watch. The weather and the live faces need a connection, through your iPhone or Wi-Fi.',
  },
  {
    q: 'Why does Rain Radar say US only?',
    a: 'The radar comes from the U.S. National Weather Service, which covers the United States, Alaska, Hawaii, Puerto Rico and Guam. Everywhere else the face says so, and every other face works the same.',
  },
  {
    q: 'What does it do with my location?',
    a: 'It rounds it to about half a mile and uses it for the weather, the sky faces, and the two live faces while they are on screen. Nothing is ever sent to us. The Privacy Policy spells out exactly where it goes.',
  },
];

/**
 * Six of the faces, as the watch draws them. Each file is 422x514, twice
 * the 211x257 the page shows it at, so it is sharp on a 2x screen.
 */
export const VECTOR_FACES_SCREENSHOTS = [
  {
    src: '/images/vector-faces/face-corridor.png',
    alt: 'A Vector Faces watch face drawn as a blue wireframe corridor, with the time to the second in glowing orange',
  },
  {
    src: '/images/vector-faces/face-flights.png',
    alt: 'The Flights face: a green radar scope showing the aircraft nearby, each labelled with its flight and altitude',
  },
  {
    src: '/images/vector-faces/face-radar.png',
    alt: 'The Rain Radar face: rain showers drawn in red on a blue radar scope, with the time the rain is due',
  },
  {
    src: '/images/vector-faces/face-nightsky.png',
    alt: 'A star chart face showing the constellations overhead, with north, south, east and west marked',
  },
  {
    src: '/images/vector-faces/face-globe.png',
    alt: 'A wireframe globe face with the continents drawn in blue lines and the time in UTC',
  },
  {
    src: '/images/vector-faces/face-movement.png',
    alt: "A watch face drawn as a clock's gears and hands in lines of gold",
  },
];

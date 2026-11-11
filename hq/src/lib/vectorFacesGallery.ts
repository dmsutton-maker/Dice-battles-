/**
 * Every Vector Faces face, in the groups and order the app shows them, for the
 * gallery on /apps/vector-faces. Generated from the watch app's own catalog by
 * Tools/Store/make_gallery.sh in the Vector Faces source, which also draws the
 * pictures in public/images/vector-faces/gallery/. Regenerate both when faces change
 * rather than editing by hand, so the site never shows a face the app does not have.
 */
export type GalleryFace = { key: string; title: string; summary: string };
export type GalleryGroup = { id: string; title: string; faces: GalleryFace[] };

export const VECTOR_FACES_GALLERY: GalleryGroup[] = [
  {
    id: 'live',
    title: 'Live',
    faces: [
      { key: 'forecast', title: 'Forecast', summary: 'The next twelve hours of temperature and rain.' },
      { key: 'flights', title: 'Flights', summary: 'Real aircraft round you on a radar scope.' },
      { key: 'rainRadar', title: 'Rain Radar', summary: 'The real weather radar round you.' },
      { key: 'decibels', title: 'Decibels', summary: 'How loud it is round you, from the microphone. An estimate.' },
      { key: 'compass', title: 'Compass', summary: 'A compass card that turns as you do.' },
    ],
  },
  {
    id: 'health',
    title: 'Health',
    faces: [
      { key: 'pulse', title: 'Pulse', summary: 'Your latest heart rate from Health, with a beating trace.' },
      { key: 'oxygen', title: 'Oxygen', summary: 'Your latest blood oxygen reading from Health.' },
      { key: 'rings', title: 'Rings', summary: 'Today\'s move, exercise and stand, against your goals.' },
    ],
  },
  {
    id: 'characters',
    title: 'Characters',
    faces: [
      { key: 'buddy', title: 'Buddy', summary: 'A round little friend who looks about, blinks and says the time.' },
      { key: 'bot', title: 'Bot', summary: 'A small robot with light-panel eyes and a dancing mouth.' },
    ],
  },
  {
    id: 'analog',
    title: 'Analog',
    faces: [
      { key: 'chrono', title: 'Chrono', summary: 'A chronograph with three small dials.' },
      { key: 'movement', title: 'Movement', summary: 'The gears of a mechanical watch at work.' },
      { key: 'analog', title: 'Analog', summary: 'A plain dial with numbers. The digital time is optional.' },
      { key: 'minimal', title: 'Minimal', summary: 'Hands and hour marks, nothing more.' },
      { key: 'roman', title: 'Roman', summary: 'Roman numerals round a minute track.' },
      { key: 'regent', title: 'Regent', summary: 'A dress watch: an engraved dial, applied markers and small seconds.' },
    ],
  },
  {
    id: 'digital',
    title: 'Digital',
    faces: [
      { key: 'calendar', title: 'Calendar', summary: 'This month with today circled.' },
      { key: 'numerals', title: 'Numerals', summary: 'Just the time, as big as it goes.' },
      { key: 'lcd', title: 'LCD', summary: 'A retro digital watch screen, segments and all.' },
    ],
  },
  {
    id: 'sky',
    title: 'Space and Sky',
    faces: [
      { key: 'orbit', title: 'Orbit', summary: 'Moons for the hands, a satellite for seconds.' },
      { key: 'eclipse', title: 'Eclipse', summary: 'The moon covers the sun at the top of each hour.' },
      { key: 'launch', title: 'Launch', summary: 'Counts down the seconds, then lifts off every minute.' },
      { key: 'moon', title: 'Moon', summary: 'Tonight\'s real moon phase, with days to full.' },
      { key: 'daylight', title: 'Daylight', summary: 'Today\'s real sunrise and sunset on a 24-hour dial.' },
      { key: 'orrery', title: 'Orrery', summary: 'The planets where they really are today.' },
      { key: 'aurora', title: 'Aurora', summary: 'Northern lights over the mountains.' },
      { key: 'globe', title: 'Globe', summary: 'The Earth with the real day and night line.' },
      { key: 'nightSky', title: 'Night Sky', summary: 'The stars over you right now.' },
      { key: 'docking', title: 'Docking', summary: 'A craft docks with a station on the minute.' },
      { key: 'singularity', title: 'Singularity', summary: 'A black hole with a glowing disc.' },
      { key: 'sunArc', title: 'Sun Arc', summary: 'The sun\'s path across the sky, from sunrise to sunset.' },
    ],
  },
  {
    id: 'instruments',
    title: 'Radar and Instruments',
    faces: [
      { key: 'sweep', title: 'Sweep', summary: 'Radar sweep for seconds, contacts for the hands.' },
      { key: 'intercept', title: 'Intercept', summary: 'Scales scroll for the hands, with a craft in the sights.' },
      { key: 'scope', title: 'Scope', summary: 'An oscilloscope beam writes the time.' },
      { key: 'sonar', title: 'Sonar', summary: 'Pings, echoes and a waterfall of past pings.' },
      { key: 'cockpit', title: 'Cockpit', summary: 'Flight tapes for the minute, hour and second.' },
      { key: 'tuner', title: 'Tuner', summary: 'A radio dial needle sweeps the hour.' },
      { key: 'reels', title: 'Reels', summary: 'Tape winds from reel to reel through the hour.' },
      { key: 'console', title: 'Console', summary: 'A green-screen status report.' },
      { key: 'circuit', title: 'Circuit', summary: 'Pads light to the hour; pulses run each second.' },
    ],
  },
  {
    id: 'sciFi',
    title: 'Sci-Fi',
    faces: [
      { key: 'corridor', title: 'Corridor', summary: 'Gate lines close in and meet on the minute.' },
      { key: 'horizon', title: 'Horizon', summary: 'Sun by day, moon by night, over a grid.' },
      { key: 'jump', title: 'Jump', summary: 'Stars streak past, and stretch as the minute ends.' },
      { key: 'bridge', title: 'Bridge', summary: 'Control panel bars fill for hour, minute and second.' },
      { key: 'reactor', title: 'Reactor', summary: 'Three rings light up: seconds, minutes, hours.' },
      { key: 'tesseract', title: 'Tesseract', summary: 'A 4-D cube turns once a minute; lit edges count the hour.' },
    ],
  },
  {
    id: 'classic',
    title: 'Art and Fun',
    faces: [
      { key: 'hourglass', title: 'Hourglass', summary: 'Sand runs through once a minute, then the glass turns over.' },
      { key: 'harmonograph', title: 'Harmonograph', summary: 'A pendulum drawing, one figure a minute.' },
      { key: 'garden', title: 'Garden', summary: 'Flowers grow and bloom as the seconds pass.' },
      { key: 'flags', title: 'Flags', summary: 'A flag flying in the breeze. Choose your country.' },
    ],
  },
];

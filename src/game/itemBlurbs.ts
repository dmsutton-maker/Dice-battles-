import type { ArenaId } from '../arena/arenas';

/**
 * One short line about every die and every battlefield, shown under its
 * name when it is opened to look at.
 *
 * David, 20 Oct 2026: "Shorten and simplify the descriptions of
 * everything. Add short descriptions of all the dice and arenas." Before
 * this every die said the same sentence about shells and face colours,
 * and every battlefield the same one about the view.
 *
 * Kept short on purpose: the line sits under the name in a two-line
 * space over the live board, and is read by five-year-olds and
 * grandparents alike. `tests/itemBlurbs.test.ts` holds every one to
 * BLURB_MAX characters and checks no die or battlefield is missing.
 */
export const BLURB_MAX = 44;

export const DIE_BLURBS: Record<string, string> = {
  ivory: 'Plain white. The classic.',
  gold: 'Shiny gold.',
  mint: 'Soft mint green.',
  bubblegum: 'Bubblegum pink.',
  midnight: 'Deep midnight blue.',
  zebra: 'Black and white stripes.',
  bubbles: 'Pale blue, full of bubbles.',
  starry: 'A night sky full of stars.',
  timber: 'Polished wood grain.',
  frost: 'Icy frost patterns.',
  marble: 'White marble with grey veins.',
  granite: 'Speckled grey stone.',
  silver: 'Shiny silver.',
  ruby: 'Deep red, like a jewel.',
  ocean: 'Rolling blue sea waves.',
  lavender: 'Soft purple lavender.',
  slate: 'Dark grey slate.',
  blossom: 'Pink blossom petals.',
  copper: 'Shiny copper.',
  paws: 'Paw prints all over.',
  cow: 'Black and white cow patches.',
  bee: 'Bumblebee stripes.',
  turtle: 'A turtle shell.',
  fish: 'Fish swimming all round it.',
  snake: 'Snakeskin scales.',
  leopard: 'Leopard spots.',
  tiger: 'Tiger stripes.',
  giraffe: 'Giraffe patches.',
  peacock: 'Peacock feathers.',
  golf: 'A dimpled golf ball.',
  tennis: 'A fuzzy tennis ball.',
  baseball: 'A baseball with red stitches.',
  soccer: 'A soccer ball.',
  basketball: 'A basketball.',
  football: 'A football with white laces.',
  bowling: 'A shiny bowling ball.',
  volleyball: 'A volleyball.',
  cookie: 'A chocolate chip cookie.',
  candycane: 'Red and white candy cane.',
  lemon: 'Lemon slices.',
  chocolate: 'A bar of chocolate.',
  strawberry: 'A strawberry, seeds and all.',
  honeycomb: 'Golden honeycomb.',
  waffles: 'Chicken and waffles.',
  watermelon: 'Watermelon, seeds and all.',
  pizza: 'A whole pizza on every side.',
  donut: 'A pink frosted donut.',
  denim: 'Blue jeans.',
  camo: 'Green camouflage.',
  tartan: 'Red tartan.',
  circuit: 'A glowing circuit board.',
  rainbow: 'A rainbow running round it.',
  galaxy: 'Swirling purple galaxies.',
  fire: 'Glowing embers that burst into flame.',
  ice: 'Clear ice that leaves frost behind.',
  amethyst: 'A deep purple gem.',
  supporter: 'A gold compass on teal.',
  neon: 'Glows pink and leaves a trail of light.',
};

export const ARENA_BLURBS: Record<ArenaId, string> = {
  castle: 'Knights fighting in a sunny courtyard.',
  castleSunset: 'A ruined castle at dusk.',
  jungle: 'A clearing deep in the jungle.',
  space: 'Spaceships fighting below the deck.',
  snow: 'Snowball fights and walking snowmen.',
  desert: 'Sand dunes, quicksand and camels.',
  volcano: 'A river of lava flowing all round.',
  autumn: 'Falling leaves and muddy puddles.',
  aurora: 'Northern lights over the ice.',
  cavern: 'Glowing crystals deep underground.',
  sky: 'High up in the clouds.',
  moon: 'Aliens walking round a moon base.',
  beach: 'Surfers, sandcastles and tide pools.',
  candy: 'Gumdrops and a chocolate pool.',
  glade: 'Glowing mushrooms in a night wood.',
  cove: 'A pirate ship and a hungry shark.',
  farm: 'Cows, sheep and chickens.',
  reef: 'Fish swimming over the coral.',
  city: 'Helicopters over the rooftops.',
  toybox: 'A toy train round the playroom.',
  dino: 'Dinosaurs roaming round a tar pit.',
};

export function dieBlurb(id: string): string {
  return DIE_BLURBS[id] ?? '';
}

export function arenaBlurb(id: ArenaId): string {
  return ARENA_BLURBS[id] ?? '';
}

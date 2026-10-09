# NUCLUME

**From a Single Atom to an Entire City.** An interactive, conceptual science exhibition: explore uranium-235, initiate fission, discover a pressurized water reactor (PWR), and follow heat, mechanical motion and electricity to a lit city. The four chapters form one continuous journey.

## Setup

Use Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). For production, run `npm run build` followed by `npm start`. No environment variables or external services are required.

## Use

- Select **Explore the nucleus** to inspect protons and neutrons. Drag the nucleus, or focus it and use arrow keys to rotate; Space pauses motion and Home resets the atom view.
- Continue to fission. Drag the neutron into the nucleus, tap it, or activate **Send the neutron** with Enter/Space.
- Continue through the reactor. Inspect a fuel rod cutaway, explore neutron absorption by control rods, or follow primary coolant to the separate secondary circuit in the steam generator.
- Follow the generator and transmission sequence into the city. Watch a home, streetlights and a hospital illuminate before the neighborhood opens up. Skip the sequence or explore Home, Hospital and Neighborhood views; replay restarts only the current chapter.
- Use the chapter navigation or return controls to revisit discoveries. Progress and selections survive chapter changes during the current visit; reloading starts over. Arrow keys/Home/End move focus within chapter navigation; Enter/Space activates a chapter.
- Motion can be paused. System reduced-motion preferences skip animated sequences while retaining controls and results. Without WebGL2, or after context loss, interactive SVG illustrations preserve the complete journey.

## Validate

```sh
npm run typecheck
npm run build
```

## Implementation and scientific scope

Next.js App Router, strict TypeScript, React Three Fiber and Three.js. One canvas uses instanced meshes, shared procedural geometries/materials, a DPR cap of 1.5 and no postprocessing. Rendering stops when hidden and settles on demand when paused or reduced motion is enabled. Inactive chapter timelines pause; later scene resources are disposed when returning to earlier chapters.

- Uranium-235 contains 92 protons and 143 neutrons ([NRC](https://www.nrc.gov/education-regulatory-research/the-student-corner/science-101/what-is-a-chain-reaction)). The selected fission channel, U-235 + n → Ba-141 + Kr-92 + 3n + energy, is one possible outcome ([OpenStax](https://openstax.org/books/university-physics-volume-3/pages/10-5-fission)).
- Control rods absorb neutrons. Pressurized primary water removes core heat and transfers it to a separate secondary circuit in the steam generator; primary coolant does not enter the turbine ([NRC: PWRs](https://www.nrc.gov/reactors/power/pwrs)).
- Secondary steam drives a turbine and coupled generator. Electricity then passes through transmission and distribution infrastructure to consumers ([EIA: generation](https://www.eia.gov/energyexplained/electricity/how-electricity-is-generated.php), [EIA: delivery](https://www.eia.gov/energyexplained/electricity/delivery-to-consumers.php)).

This is an educational illustration, not a physical simulation or engineering model. Dimensions, timing, colors, light, particle placement, rod counts and energy output are illustrative and are not quantitatively validated. Ambient motes are atmospheric, not emitted particles. Electrons and many plant systems are omitted. One atom cannot power a city; the city represents the collective output of sustained reactions.

## Assets and licensing

All visual assets are generated in this repository using geometry, procedural textures, SVG and CSS. Fonts use system stacks; no external models, images, audio or font files are bundled. Scientific reference links provide attribution, not endorsements.

**No project license has been selected.** An owner-approved license is still required before an open-source release; this README does not grant one.

Dependencies retain their own licenses and notices. The direct runtime dependencies use MIT; TypeScript uses Apache-2.0. The lockfile also includes [caniuse-lite](https://github.com/browserslist/caniuse-lite) data by Ben Briggs under CC-BY-4.0 and optional Sharp/libvips native packages with LGPL and other bundled component licenses. Preserve applicable upstream notices and attribution, and review native-binary redistribution obligations before distributing a packaged runtime. Installed package `LICENSE`/`COPYING` files and `@img/sharp-libvips-*/README.md` list the relevant terms; the project license will not replace them.

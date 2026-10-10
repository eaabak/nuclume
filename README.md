# NUCLUME

**From a Single Atom to an Entire City.** An interactive, conceptual science exhibition: explore uranium-235, initiate fission, discover a pressurized water reactor (PWR), and follow heat, mechanical motion and electricity to a lit city. The four chapters form one continuous journey.

## AI-assisted development

NUCLUME was conceived and directed by [eaabak](https://github.com/eaabak). AI coding tools were used to generate code, debug issues, and refine the implementation. The project author remains responsible for its scope, creative direction, release decisions, and published work. Validation procedures and scientific limitations are documented below.

AI-generated reference images supplied by the project author guided the visual direction. The logo mark and favicon are implemented as SVG, and the interactive scenes use procedural geometry, textures and lighting developed through the same AI-assisted coding process. The reference images are not bundled with the application.

## Setup

Use Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). For production, run `npm run build` followed by `npm start`. No environment variables or external services are required.

## Use

- Scroll through the opening, or select **Come closer**, to inspect protons and neutrons. Drag the nucleus with a mouse, or focus it and use arrow keys to rotate; Space pauses motion and Home resets the atom view. Mobile swipes keep native scrolling.
- Continue to fission. Drag the neutron into the nucleus, tap it, or activate **Send the neutron** with Enter/Space.
- Continue through the reactor. Inspect a fuel rod cutaway, explore neutron absorption by control rods, or follow primary coolant to the separate secondary circuit in the steam generator. Use the wheel or pinch to zoom, drag to pan, or focus the scene and use arrow keys and +/−. Home or **Reset view** restores the camera.
- Follow the generator and transmission sequence into the city. Watch a home, streetlights and a hospital illuminate before the neighborhood opens up. Skip the sequence or explore Home, Hospital and Neighborhood views; replay restarts only the current chapter.
- Use the chapter navigation or return controls to revisit discoveries. Progress and selections survive chapter changes during the current visit; reloading starts over. Arrow keys/Home/End move focus within chapter navigation; Enter/Space activates a chapter.
- Motion can be paused. System reduced-motion preferences skip animated sequences while retaining controls and results. Without WebGL2, or after context loss, interactive SVG illustrations preserve the complete journey.
- English and Turkish are available throughout. Sound is optional. Web Audio mixes recorded machinery, pipe flow and steam with procedural ambience; recordings load only after sound is enabled and the reactor is reached. Pause and hidden tabs suspend playback.

## Validate

```sh
npm run typecheck
npm run build
```

## Implementation and scientific scope

### Code organization

- `src/components/atom-experience.tsx` connects chapter controllers and navigation. `use-scene-environment` owns browser capability/lifecycle checks; `use-scene-input` owns pointer and keyboard input. UI chrome and the science dialog have separate components.
- Chapter hooks own timelines and interaction state. Scene components own GPU resources and rendering; `src/lib` contains conceptual model data, paths, timings and shared scene types. The Canvas remains mounted across chapter changes.
- `src/styles/tokens.css` defines interface colors. `src/lib/scene-colors.ts` defines scene color roles, with intentional material-specific shades kept locally. `src/app/globals.css` imports styles in cascade order; preserve that order when adding rules.

### Rendering and model

Next.js App Router, strict TypeScript, React Three Fiber and Three.js. One canvas uses instanced meshes, shared procedural geometries/materials, a DPR cap of 1.5 and no postprocessing. Rendering stops when hidden and settles on demand when paused or reduced motion is enabled. Inactive chapter timelines pause; later scene resources are disposed when returning to earlier chapters.

- Uranium-235 contains 92 protons and 143 neutrons ([NRC](https://www.nrc.gov/education-regulatory-research/the-student-corner/science-101/what-is-a-chain-reaction)). The selected fission channel, U-235 + n → Ba-141 + Kr-92 + 3n + energy, is one possible outcome ([OpenStax](https://openstax.org/books/university-physics-volume-3/pages/10-5-fission)).
- Control rods absorb neutrons. Pressurized primary water removes core heat and transfers it to a separate secondary circuit in the steam generator; primary coolant does not enter the turbine ([NRC: PWRs](https://www.nrc.gov/reactors/power/pwrs)).
- Secondary steam drives a turbine and coupled generator. Electricity then passes through transmission and distribution infrastructure to consumers ([EIA: generation](https://www.eia.gov/energyexplained/electricity/how-electricity-is-generated.php), [EIA: delivery](https://www.eia.gov/energyexplained/electricity/delivery-to-consumers.php)).

This is an educational illustration, not a physical simulation or engineering model. Dimensions, timing, colors, light, particle placement, rod counts and energy output are illustrative and are not quantitatively validated. Ambient motes are atmospheric, not emitted particles. Electrons and many plant systems are omitted. One atom cannot power a city; the city represents the collective output of sustained reactions.

NUCLUME is an independent educational and artistic project. It is not reactor-operation guidance, a safety analysis, an engineering design tool, or certified operator training. Do not rely on its simplified visualization for operational or safety decisions. Source citations do not imply review, approval or endorsement by the cited organizations. This description states the project's intended purpose; it does not impose additional restrictions on the MIT license.

## Assets and licensing

All visual assets are generated in this repository using geometry, procedural textures, SVG and CSS. Fonts use system stacks; no external models, images or font files are bundled. The edited audio recordings in `public/audio` are self-hosted CC0 assets; [audio credits](public/audio/CREDITS.md) list their authors, source links and processing. They are illustrative sound design, not recordings of a nuclear plant. Scientific reference links provide attribution, not endorsements.

The visual direction was developed from AI-generated reference images supplied by the project author. Those images are not included in this repository or used as rendered scene backgrounds. Any future redistribution of the reference images requires a separate review of the originating service's terms and applicable rights.

The project source code and original documentation are available under the [MIT License](LICENSE), copyright © 2026 eaabak. MIT permits commercial and noncommercial reuse, modification and redistribution while requiring preservation of the copyright and license notices. It includes warranty and liability disclaimers to the extent permitted by applicable law. Third-party recordings and dependencies retain their separate terms below.

Dependencies retain their own licenses and notices. The direct runtime dependencies use MIT; TypeScript uses Apache-2.0. The lockfile also includes [caniuse-lite](https://github.com/browserslist/caniuse-lite) data by Ben Briggs under CC-BY-4.0 and optional Sharp/libvips native packages with LGPL and other bundled component licenses. Preserve applicable upstream notices and attribution, and review native-binary redistribution obligations before distributing a packaged runtime. Installed package `LICENSE`/`COPYING` files and `@img/sharp-libvips-*/README.md` list the relevant terms; the project license will not replace them.

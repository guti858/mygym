import { Composition, Folder } from 'remotion';
import { STATION_MODULES } from '../stations/modules';
import { DEFAULT_HUB_PROPS, defaultStationProps } from './defaults';
import { HubComposition } from './HubComposition';
import { COMP_H, COMP_W, compositionId, FPS, type StationCompProps } from './props';
import { StationComposition } from './StationComposition';
import { durationInFrames, stationTimeline } from './timing';

/** Raíz para Remotion Studio / CLI: una composición por estación y variante, más el gimnasio. */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="gimnasio" component={HubComposition} durationInFrames={8 * FPS} fps={FPS} width={1600} height={900} defaultProps={DEFAULT_HUB_PROPS} />
      <Folder name="Estaciones">
        {Object.values(STATION_MODULES).flatMap((mod) =>
          mod.content.variants.map((v) => (
            <Composition
              key={`${mod.content.id}-${v.id}`}
              id={compositionId(mod.content.id, v.id)}
              component={StationComposition}
              durationInFrames={10 * FPS}
              fps={FPS}
              width={COMP_W}
              height={COMP_H}
              defaultProps={defaultStationProps(mod.content.id, v.id)}
              calculateMetadata={({ props }: { props: StationCompProps }) => ({
                durationInFrames: durationInFrames(stationTimeline(props.tempo, props.reps, mod.logic.startAt), FPS),
              })}
            />
          )),
        )}
      </Folder>
    </>
  );
};

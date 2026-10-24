import { CallSimulator } from "@/components/lab/CallSimulator";
import { DemoControls } from "@/components/lab/DemoControls";
import { GpsTrackerSim } from "@/components/lab/GpsTrackerSim";
import { ScenarioLauncher } from "@/components/lab/ScenarioLauncher";
import { SignalControllerSim } from "@/components/lab/SignalControllerSim";
import { VitalsMonitorSim } from "@/components/lab/VitalsMonitorSim";

export default function LabPage() {
  return (
    <div className="space-y-3">
      <ScenarioLauncher />
      <CallSimulator />
      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
        <VitalsMonitorSim />
        <div className="flex flex-col gap-3">
          <GpsTrackerSim />
          <DemoControls />
        </div>
      </div>
      <SignalControllerSim />
    </div>
  );
}
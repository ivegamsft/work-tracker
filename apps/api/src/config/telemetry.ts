import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
  type MetricReader,
} from "@opentelemetry/sdk-metrics";
import { metrics, type Meter } from "@opentelemetry/api";

const APP_START_TIME = Date.now();

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: "e-clat-api",
  [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? "0.4.0",
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
});

let sdk: NodeSDK | undefined;
let meterProvider: MeterProvider | undefined;

export function initTelemetry(): void {
  if (sdk) return;

  const isTest = process.env.NODE_ENV === "test";

  // Traces — console exporter for dev, silent for tests
  const traceExporter = isTest ? undefined : new ConsoleSpanExporter();

  // Metrics — periodic export (console for dev)
  const readers: MetricReader[] = [];
  if (!isTest) {
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 60_000,
      }),
    );
  }

  meterProvider = new MeterProvider({ resource, readers });
  metrics.setGlobalMeterProvider(meterProvider);

  sdk = new NodeSDK({
    resource,
    traceExporter,
  });

  sdk.start();
}

export function shutdownTelemetry(): Promise<void> {
  const promises: Promise<void>[] = [];
  if (sdk) promises.push(sdk.shutdown());
  if (meterProvider) promises.push(meterProvider.shutdown());
  return Promise.all(promises).then(() => undefined);
}

export function getMeter(name = "e-clat-api"): Meter {
  return metrics.getMeter(name);
}

export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - APP_START_TIME) / 1000);
}

export { APP_START_TIME };

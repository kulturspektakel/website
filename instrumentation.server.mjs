import * as Sentry from "@sentry/remix";

Sentry.init({
    dsn: "https://0a051473668a7010ad81176d2918a88f@o489311.ingest.us.sentry.io/4506423472422912",
    tracesSampleRate: 1,
    autoInstrumentRemix: true
})
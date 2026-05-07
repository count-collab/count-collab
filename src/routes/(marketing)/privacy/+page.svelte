<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
</script>

<MetaTags
  title="Datenschutz — Count Collab"
  description="Datenschutzerklärung und Informationen zum Schutz Ihrer Daten bei Count Collab."
  path="/privacy"
/>

<div class="max-w-3xl mx-auto px-4 py-16 sm:py-24">
  <div class="text-center mb-12">
    <h1
      class="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100"
    >
      Datenschutz / Privacy
    </h1>
    <p class="mt-4 text-lg text-slate-500 dark:text-slate-400">
      Datenschutzerklärung / Privacy Policy
    </p>
  </div>

  <!-- Deutsch -->
  <section class="mb-16">
    <h2
      class="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-8 border-b border-slate-200 dark:border-slate-700 pb-2"
    >
      Deutsch
    </h2>

    <div class="space-y-8 text-slate-700 dark:text-slate-300">
      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          1. Verantwortlicher
        </h3>
        <p>Marvin Ständer</p>
        <p>Derendorfer Straße 14</p>
        <p>40479 Düsseldorf, Deutschland</p>
        <p>
          E-Mail:
          <a
            href="mailto:support@count-collab.cc"
            class="text-blue-600 dark:text-blue-400 hover:underline"
            >support@count-collab.cc</a
          >
        </p>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Ein Datenschutzbeauftragter ist für dieses Projekt gesetzlich nicht
          erforderlich.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          2. Erhobene Daten
        </h3>
        <p>Bei der Nutzung von Count Collab werden folgende Daten erhoben:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>E-Mail-Adresse</li>
          <li>Anzeigename</li>
          <li>IP-Adresse</li>
          <li>
            OAuth-Profildaten (Avatar, Provider-ID) über die Anbieter Google,
            Twitch und Discord
          </li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          3. Rechtsgrundlage
        </h3>
        <p>Die Verarbeitung Ihrer Daten erfolgt auf Grundlage von:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Art. 6 Abs. 1 lit. a DSGVO</strong> — Einwilligung (z.&nbsp;B.
            bei der Anmeldung über OAuth)
          </li>
          <li>
            <strong>Art. 6 Abs. 1 lit. b DSGVO</strong> — Vertragserfüllung (Bereitstellung
            des Dienstes)
          </li>
          <li>
            <strong>Art. 6 Abs. 1 lit. f DSGVO</strong> — Berechtigtes Interesse (Sicherheit,
            Missbrauchsschutz)
          </li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          4. Cookies
        </h3>
        <p>Count Collab verwendet folgende Cookies:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Session-Cookies</strong> — für die Authentifizierung und Sitzungsverwaltung
          </li>
          <li>
            <strong>Cloudflare-Cookies</strong> (<code class="text-sm"
              >__cf_bm</code
            >,
            <code class="text-sm">__cflb</code>) — für Bot-Management und Load
            Balancing
          </li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          5. Analyse und Tracking
        </h3>
        <p>
          <strong>Cloudflare Web Analytics:</strong> Wir verwenden Cloudflare Web
          Analytics zur Analyse der Websitenutzung. Dieser Dienst ist datenschutzfreundlich,
          verwendet keine Cookies und erhebt keine personenbezogenen Daten.
        </p>
        <p class="mt-2">
          <strong>PostHog (geplant):</strong> Die Einbindung von PostHog für Event-Tracking
          ist geplant, aber derzeit noch nicht aktiv.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          6. Hosting
        </h3>
        <p>
          Diese Website wird gehostet von
          <strong>Hetzner Online GmbH</strong>, Industriestr. 25, 91710
          Gunzenhausen, Deutschland. Der Server befindet sich in Falkenstein,
          Deutschland.
        </p>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Ein Auftragsverarbeitungsvertrag (AVV) mit Hetzner wurde
          abgeschlossen.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          7. CDN und Proxy
        </h3>
        <p>
          Wir nutzen <strong>Cloudflare, Inc.</strong> als DNS-Provider und Reverse
          Proxy. Cloudflare ist ein US-amerikanisches Unternehmen, das Daten auf Grundlage
          der EU-Standardvertragsklauseln (SCCs) verarbeitet.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          8. Datenübermittlung an Dritte
        </h3>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Cloudflare (USA)</strong> — Datenverarbeitung auf Grundlage der
            EU-Standardvertragsklauseln
          </li>
          <li>
            <strong>OAuth-Anbieter (Google, Twitch, Discord)</strong> — Übermittlung
            minimaler Profildaten bei der Anmeldung
          </li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          9. Ihre Rechte (DSGVO Art. 15–21)
        </h3>
        <p>Sie haben das Recht auf:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>Auskunft über Ihre gespeicherten Daten (Art. 15)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16)</li>
          <li>Löschung Ihrer Daten (Art. 17)</li>
          <li>Einschränkung der Verarbeitung (Art. 18)</li>
          <li>Datenübertragbarkeit (Art. 20)</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21)</li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          10. Kontolöschung
        </h3>
        <p>
          Sie können Ihr Konto jederzeit über die
          <a
            href="/settings"
            class="text-blue-600 dark:text-blue-400 hover:underline"
            >Einstellungen</a
          >
          löschen oder eine Löschung per E-Mail an
          <a
            href="mailto:support@count-collab.cc"
            class="text-blue-600 dark:text-blue-400 hover:underline"
            >support@count-collab.cc</a
          > beantragen.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          11. Datenspeicherung und -löschung
        </h3>
        <p>
          Ihre Daten werden bei Kontolöschung gelöscht. Server-Logs werden
          maximal 7 Tage aufbewahrt.
        </p>
      </div>
    </div>
  </section>

  <!-- English -->
  <section>
    <h2
      class="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-8 border-b border-slate-200 dark:border-slate-700 pb-2"
    >
      English
    </h2>

    <div class="space-y-8 text-slate-700 dark:text-slate-300">
      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          1. Responsible Party
        </h3>
        <p>Marvin Ständer</p>
        <p>Derendorfer Straße 14</p>
        <p>40479 Düsseldorf, Germany</p>
        <p>
          Email:
          <a
            href="mailto:support@count-collab.cc"
            class="text-blue-600 dark:text-blue-400 hover:underline"
            >support@count-collab.cc</a
          >
        </p>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          A Data Protection Officer is not legally required for this project.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          2. Data Collected
        </h3>
        <p>When using Count Collab, the following data is collected:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>Email address</li>
          <li>Display name</li>
          <li>IP address</li>
          <li>
            OAuth profile data (avatar, provider ID) via Google, Twitch, and
            Discord
          </li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          3. Legal Basis
        </h3>
        <p>Your data is processed on the basis of:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Art. 6(1)(a) GDPR</strong> — Consent (e.g., when signing in via
            OAuth)
          </li>
          <li>
            <strong>Art. 6(1)(b) GDPR</strong> — Performance of a contract (providing
            the service)
          </li>
          <li>
            <strong>Art. 6(1)(f) GDPR</strong> — Legitimate interest (security, abuse
            prevention)
          </li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          4. Cookies
        </h3>
        <p>Count Collab uses the following cookies:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Session cookies</strong> — for authentication and session management
          </li>
          <li>
            <strong>Cloudflare cookies</strong> (<code class="text-sm"
              >__cf_bm</code
            >,
            <code class="text-sm">__cflb</code>) — for bot management and load
            balancing
          </li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          5. Analytics and Tracking
        </h3>
        <p>
          <strong>Cloudflare Web Analytics:</strong> We use Cloudflare Web Analytics
          to analyze website usage. This service is privacy-friendly, does not use
          cookies, and does not collect personal data.
        </p>
        <p class="mt-2">
          <strong>PostHog (planned):</strong> Integration of PostHog for event tracking
          is planned but not yet active.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          6. Hosting
        </h3>
        <p>
          This website is hosted by
          <strong>Hetzner Online GmbH</strong>, Industriestr. 25, 91710
          Gunzenhausen, Germany. The server is located in Falkenstein, Germany.
        </p>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          A Data Processing Agreement (DPA) with Hetzner is in place.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          7. CDN and Proxy
        </h3>
        <p>
          We use <strong>Cloudflare, Inc.</strong> as a DNS provider and reverse proxy.
          Cloudflare is a US company that processes data based on EU Standard Contractual
          Clauses (SCCs).
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          8. Third-Party Data Transfers
        </h3>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Cloudflare (US)</strong> — Data processing based on EU Standard
            Contractual Clauses
          </li>
          <li>
            <strong>OAuth providers (Google, Twitch, Discord)</strong> — Transfer
            of minimal profile data during sign-in
          </li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          9. Your Rights (GDPR Art. 15–21)
        </h3>
        <p>You have the right to:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>Access your stored data (Art. 15)</li>
          <li>Rectification of inaccurate data (Art. 16)</li>
          <li>Erasure of your data (Art. 17)</li>
          <li>Restriction of processing (Art. 18)</li>
          <li>Data portability (Art. 20)</li>
          <li>Object to processing (Art. 21)</li>
        </ul>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          10. Account Deletion
        </h3>
        <p>
          You can delete your account at any time via the
          <a
            href="/settings"
            class="text-blue-600 dark:text-blue-400 hover:underline">Settings</a
          >
          page or by sending an email to
          <a
            href="mailto:support@count-collab.cc"
            class="text-blue-600 dark:text-blue-400 hover:underline"
            >support@count-collab.cc</a
          >.
        </p>
      </div>

      <div>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          11. Data Retention
        </h3>
        <p>
          Your data is deleted upon account deletion. Server logs are retained
          for a maximum of 7 days.
        </p>
      </div>
    </div>
  </section>
</div>

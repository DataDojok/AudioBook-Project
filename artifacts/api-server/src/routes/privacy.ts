import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const privacyPolicy = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy Policy | PDF Audiobook Reader</title>
  <style>
    :root { color-scheme: light; --ink: #182126; --muted: #5d686b; --paper: #f7f4ef; --card: #ffffff; --accent: #c9894b; --line: #ded8cf; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(860px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0 72px; }
    header { margin-bottom: 36px; }
    .eyebrow { color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 8px 0 12px; font-size: clamp(32px, 6vw, 52px); line-height: 1.05; letter-spacing: -.04em; }
    h2 { margin: 34px 0 10px; font-size: 23px; line-height: 1.2; }
    p, li { color: var(--muted); }
    .intro, .card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 22px 24px; }
    .intro { font-size: 18px; }
    ul { padding-left: 24px; }
    a { color: #9a5d27; font-weight: 650; }
    footer { border-top: 1px solid var(--line); margin-top: 44px; padding-top: 20px; color: var(--muted); font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">Chapter &amp; Voice</div>
      <h1>Privacy Policy</h1>
      <p>PDF Audiobook Reader</p>
    </header>

    <section class="intro">
      <strong>Effective date: September 2, 2026</strong>
      <p>This policy explains how PDF Audiobook Reader handles information when you import a PDF and listen to it using the app.</p>
    </section>

    <h2>1. Information the app handles</h2>
    <p>PDF Audiobook Reader does not require an account and does not ask for your name, email address, contacts, location, camera, microphone, or advertising identifier.</p>
    <ul>
      <li><strong>PDFs:</strong> A PDF is selected by you through your device's document picker. The PDF and its extracted text remain on your device in the current free version.</li>
      <li><strong>Library and playback data:</strong> Book titles, reading progress, selected device voice, and playback speed are stored locally on your device using the app's local storage.</li>
      <li><strong>Device narration:</strong> Free narration uses the text-to-speech voices installed on your device. The app does not upload that text for device narration.</li>
      <li><strong>Anonymous technical requests:</strong> The current free version does not send your PDF, extracted text, or reading progress to our server. The app may make standard requests needed to check service availability.</li>
    </ul>

    <h2>2. Enhanced Voices</h2>
    <p>Enhanced Voices and its purchase flow are temporarily disabled in this release. No cloud AI narration or subscription purchase is available in the current version. If that feature is enabled in a future release, this policy will be updated before activation to explain the data sent to the narration and payment providers.</p>

    <h2>3. Sharing and retention</h2>
    <p>We do not sell your information. In the current free version, imported PDFs, extracted text, library contents, and playback progress are not uploaded to us. Local data remains on your device until you remove it in the app, clear the app's storage, or uninstall the app. The operating system may retain normal temporary cache files according to its own storage behavior.</p>

    <h2>4. Security</h2>
    <p>The app relies on the security controls provided by your operating system and standard secure network transport where network requests are used. No method of storage or transmission is completely secure, so keep your device and operating system updated.</p>

    <h2>5. Children</h2>
    <p>The app is not directed to children under 13, and we do not knowingly collect personal information from children. If you believe a child has provided personal information, contact the publisher at <a href="mailto:keiver.asanchez@gmail.com">keiver.asanchez@gmail.com</a>.</p>

    <h2>6. Copyright and content</h2>
    <div class="card">
      <p>You are responsible for the PDFs and other content you import into PDF Audiobook Reader. You may import and use only content that you own or are legally authorized to access, copy, transform, and listen to. You must not use the app to infringe copyright, trademark, privacy, publicity, or other rights; bypass digital rights management; distribute unauthorized copies; or make copyrighted books available to other people without permission.</p>
      <p>The app does not provide a catalog of books, host user-imported books for public download, or grant you rights to any content. If you believe content is being used unlawfully, contact the person who supplied it or the publisher at <a href="mailto:keiver.asanchez@gmail.com">keiver.asanchez@gmail.com</a>.</p>
    </div>

    <h2>7. Changes to this policy</h2>
    <p>We may update this policy when the app's features or data practices change. The effective date at the top will be updated when a new version is published.</p>

    <h2>8. Contact</h2>
    <p>For privacy questions or requests, contact <a href="mailto:keiver.asanchez@gmail.com">keiver.asanchez@gmail.com</a>. Please include enough detail for the publisher to understand your request, but do not send the contents of a private book unless necessary.</p>

    <footer>PDF Audiobook Reader · Privacy Policy · Effective September 2, 2026</footer>
  </main>
</body>
</html>`;

router.get("/privacy", (_request: Request, response: Response) => {
  response.type("html").send(privacyPolicy);
});

export default router;
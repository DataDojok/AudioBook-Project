# Publish PDF Audiobook Reader to Google Play

This project includes a GitHub Actions workflow that creates a signed Android
App Bundle (`.aab`). The workflow is manual on purpose: each Google Play
upload needs a new, higher Android version code.

## Important signing rule

The upload keystore is the identity used to update this app. If it is lost,
future updates can become difficult or impossible. Keep an encrypted backup
outside GitHub. Never commit the `.jks` file, passwords, or the base64 text to
the repository.

The app's current Android identity is:

- Package name: `com.pdfvoicereader.app`
- Version name: `1.0.0`
- Starting version code: `1`

Do not change the package name after the first Play upload.

## Build compatibility notes

The app directly declares `babel-preset-expo` because its Babel configuration
uses that preset and pnpm does not expose undeclared transitive packages to the
app. The app also uses the JSC JavaScript engine for native builds because the
PDF.js runtime contains dynamic imports that the Hermes bytecode compiler
rejects during the Android release bundle step.

## 1. Create a GitHub repository

1. Create an empty repository on GitHub.
2. Push this project to it, including the `artifacts/`,
   `lib/`, `scripts/`, `package.json`, and `pnpm-lock.yaml` files.
3. Confirm that `.gitignore` is active before pushing. In particular, the
   Android project and any `.jks` files should remain untracked.

If you use the GitHub website to create the repository, do not upload the
keystore there.

## 2. Create the Android upload keystore

Run this on your own computer, not in GitHub and not in the repository folder
if you are worried about accidentally committing it. You need Java's
`keytool`. Android Studio includes a compatible Java runtime; a standalone JDK
also works.

Linux or macOS:

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore upload-keystore.p12 \
  -alias pdf-audiobook-reader-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Windows PowerShell:

```powershell
keytool -genkeypair -v `
  -storetype PKCS12 `
  -keystore upload-keystore.p12 `
  -alias pdf-audiobook-reader-upload `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

When prompted:

- Choose a strong keystore password.
  - Use the same password for the key, or record a separate key password.
- The alias must be exactly `pdf-audiobook-reader-upload` if you use the
  command above.
- The name, organization, and location prompts are certificate metadata; use
  your publisher or business details.

Make two encrypted backups of `upload-keystore.p12`. You will need the
passwords and alias again for every future update.

## 3. Convert the keystore to one GitHub secret

The workflow receives the keystore as base64 text and reconstructs it only
inside the temporary GitHub Actions runner. The workflow supports the
PKCS12 `.p12` format produced by newer Java installations.

Linux:

```bash
base64 -w 0 upload-keystore.p12 > upload-keystore.base64.txt
```

macOS:

```bash
base64 -i upload-keystore.p12 | tr -d '\n' > upload-keystore.base64.txt
```

Windows PowerShell:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("upload-keystore.p12")
) | Set-Content -NoNewline upload-keystore.base64.txt
```

Do not paste the base64 value into a normal issue, pull request, chat, or
committed file.

## 4. Add GitHub Actions secrets

In your GitHub repository:

1. Open **Settings**.
2. Open **Secrets and variables** → **Actions**.
3. Select **New repository secret**.
4. Create these four secrets:

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The complete contents of `upload-keystore.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password |
| `ANDROID_KEY_ALIAS` | `pdf-audiobook-reader-upload` |
| `ANDROID_KEY_PASSWORD` | The key password |

GitHub masks secret values in logs. Do not use the **Variables** tab for these
values; use **Secrets**.

After creating `ANDROID_KEYSTORE_BASE64`, securely delete the temporary
base64 text file from your computer unless you need it for another backup.

## 5. Run the bundle build

1. Open the repository's **Actions** tab.
2. Select **Build Android App Bundle**.
3. Click **Run workflow**.
4. Leave the branch set to the branch containing this workflow.
5. For the first upload, enter version code `1`.
6. Click **Run workflow**.
7. Open the new workflow run and wait for the green checkmark.
8. Scroll to **Artifacts** at the bottom of the run.
9. Download `pdf-audiobook-reader-aab`.
10. Unzip it. The file you upload to Google Play is `app-release.aab`.

If the run fails:

- A missing secret error means one of the four secret names is misspelled or
  was added to a different repository.
- A signing error usually means the alias or one of the two passwords does not
  match the keystore.
- A version error means the new version code is not greater than the highest
  code already uploaded to Play.
- A Gradle or dependency error should be fixed in the repository before
  retrying; do not create a new keystore for a build error.

## 6. Create the Play Console app

In Google Play Console:

1. Create a new app.
2. Choose **App** and choose the default language.
3. Enter the public app name **PDF Audiobook Reader**.
4. Choose whether the app is free or paid.
5. Confirm that the app is not primarily child-directed unless that is
   actually your target audience.
6. Complete the declarations shown by Play Console.

When Play Console asks for the application ID/package name, it must be:

```text
com.pdfvoicereader.app
```

The package name is the permanent identity of the listing.

## 7. Prepare the required listing information

Before production release, Play Console will ask for items such as:

- App icon and feature graphic
- Short description and full description
- Phone screenshots
- App category and tags
- Contact email
- Privacy policy URL
- Data safety answers
- Content rating questionnaire
- Target audience and content

The app imports PDFs selected by the user and stores the library and playback
progress locally. Review the included privacy policy before publishing:

```text
artifacts/pdf-audiobook-reader/server/templates/privacy-policy.html
```

The privacy policy must be reachable at a stable public HTTPS URL. Do not
enter a temporary development URL. If you publish the included server route,
its public `/privacy` page can be used after you have confirmed the deployed
URL and the policy is accurate for your release.

## 8. Create an internal test release first

Do not start with Production. Use a test track:

1. In Play Console, open **Testing** → **Internal testing**.
2. Create a release.
3. Upload `app-release.aab`.
4. Add your own Google account as a tester.
5. Review the release and roll it out to internal testing.
6. Open the generated tester link on an Android phone.
7. Install the app and test:
   - Importing a selectable-text PDF
   - Rejecting a scanned/image-only PDF
   - Chapter navigation
   - Play, pause, skip, and resume
   - Narrator selection
   - Playback speed
   - Library removal
   - Privacy policy link
   - Android back navigation

The device must have a text-to-speech voice installed for narration. Test on
at least one recent Android phone and one smaller screen if possible.

## 9. Promote to production

After internal testing:

1. Fix any problems and create another GitHub Actions build.
2. Increase the version code to `2` or higher when running the workflow.
3. Upload the new AAB to the next testing track if you want wider testing.
4. Complete every Play Console requirement shown under **Dashboard**.
5. Create a Production release.
6. Upload the tested AAB or promote the tested release, depending on the
   Play Console option shown.
7. Review the declarations carefully and submit the release.

For every future update, the version code must increase. The workflow's
`version_code` input is the number that controls this. Keep the version name
and release notes aligned with what changed.
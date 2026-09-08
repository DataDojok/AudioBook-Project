import fs from "node:fs";
import path from "node:path";

const buildGradlePath = path.resolve("android", "app", "build.gradle");
const original = fs.readFileSync(buildGradlePath, "utf8");

if (original.includes("signingConfigs.release")) {
  throw new Error("android/app/build.gradle already contains a release signing configuration.");
}

const signingConfigsPattern =
  /    signingConfigs \{[\s\S]*?\n    \}\n    buildTypes \{/;

const signingConfigs = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
             storeType System.getenv('ANDROID_KEYSTORE_TYPE')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }
    buildTypes {`;

const withReleaseSigningConfig = original.replace(
  signingConfigsPattern,
  signingConfigs,
);

if (withReleaseSigningConfig === original) {
  throw new Error("Expo generated an unexpected android/app/build.gradle shape; release signing was not configured.");
}

const buildTypesStart = withReleaseSigningConfig.indexOf("    buildTypes {");
const releaseStart = withReleaseSigningConfig.indexOf(
  "        release {",
  buildTypesStart,
);
const releaseEnd = withReleaseSigningConfig.indexOf(
  "\n        }\n    }",
  releaseStart,
);
const releaseSigningLine = withReleaseSigningConfig.indexOf(
  "            signingConfig signingConfigs.debug",
  releaseStart,
);

if (
  buildTypesStart === -1 ||
  releaseStart === -1 ||
  releaseEnd === -1 ||
  releaseSigningLine === -1 ||
  releaseSigningLine > releaseEnd
) {
  throw new Error("Could not switch the release build type to the upload keystore.");
}

const withReleaseSigning =
  withReleaseSigningConfig.slice(0, releaseSigningLine) +
  "            signingConfig signingConfigs.release" +
  withReleaseSigningConfig.slice(
    releaseSigningLine + "            signingConfig signingConfigs.debug".length,
  );

fs.writeFileSync(buildGradlePath, withReleaseSigning);
console.log("Configured the Android release build to use the GitHub Actions upload keystore.");
plugins {
    id("com.android.application")
}

android {
    namespace = "com.zilo.banmuharvest"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.zilo.banmuharvest"
        minSdk = 24
        targetSdk = 34
        versionCode = 55
        versionName = "5.1.5"
    }

    // fixed debug key (checked in) so every debug build installs over the previous one
    signingConfigs {
        getByName("debug") {
            storeFile = rootProject.file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    sourceSets {
        getByName("main") {
            assets.srcDirs(layout.buildDirectory.dir("gameAssets"))
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// the game itself lives in ../harvest; copy it into the APK's assets
val syncGame by tasks.registering(Sync::class) {
    from(rootProject.file("../harvest")) {
        include("index.html", "style.css", "js/**", "vendor/**", "models/**")
    }
    into(layout.buildDirectory.dir("gameAssets/harvest"))
}
tasks.named("preBuild") { dependsOn(syncGame) }

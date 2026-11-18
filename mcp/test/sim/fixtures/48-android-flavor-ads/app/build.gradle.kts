plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.wallpix"
    compileSdk = 36
    flavorDimensions += "tier"
    productFlavors {
        create("free") { dimension = "tier"; applicationIdSuffix = ".free" }
        create("paid") { dimension = "tier" }
    }

    defaultConfig {
        applicationId = "com.sim.wallpix"
        minSdk = 24
        targetSdk = 36
        versionCode = 9
        versionName = "1.9.0"
    }
}

dependencies {
    "freeImplementation"("com.google.android.gms:play-services-ads:23.6.0")
    freeImplementation("com.google.android.ump:user-messaging-platform:3.1.0")
    debugImplementation("com.squareup.leakcanary:leakcanary-android:2.14")
    implementation("androidx.core:core-ktx:1.15.0")

}

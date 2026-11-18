plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.habitly"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.habitly"
        minSdk = 24
        targetSdk = 36
        versionCode = 8
        versionName = "1.8.0"
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-analytics-ktx")
    implementation("com.google.firebase:firebase-crashlytics-ktx")
    implementation("androidx.core:core-ktx:1.15.0")

}

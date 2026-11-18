package com.sim.runloop
import com.google.android.gms.location.FusedLocationProviderClient
class TrackService { fun upload(lat: Double, lng: Double) = api.post("https://api.runloop.app/track?lat=$lat&lng=$lng") }

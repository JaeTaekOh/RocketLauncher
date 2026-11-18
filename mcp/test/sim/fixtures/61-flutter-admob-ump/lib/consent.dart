import 'package:google_mobile_ads/google_mobile_ads.dart';
void gather() {
  ConsentInformation.instance.requestConsentInfoUpdate(ConsentRequestParameters(), () async { ConsentForm.loadAndShowConsentFormIfRequired((e) {}); }, (e) {});
}

import 'package:purchases_flutter/purchases_flutter.dart';
const termsUrl = 'https://calmly-app.github.io/terms';
const privacyUrl = 'https://calmly-app.github.io/privacy';
Future<void> buy(Package p) => Purchases.purchasePackage(p);

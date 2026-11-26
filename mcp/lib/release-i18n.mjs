/* Rocket Launcher 0.2.0 — texts for the release-check tools. English is complete; ko / th / zh / hi cover the headline
   strings (summaries, severities, titles). Missing keys fall back to English. */
const en = {
  'sev.block': 'Must fix', 'sev.warn': 'Check', 'sev.check': 'Confirm in the console', 'sev.ok': 'OK', 'sev.info': 'Info',
  'req.title': 'Store requirements and deadlines',
  'req.summary': '{block} must fix · {warn} to check · {check} to confirm in the console · {ok} OK. Rules verified on {date}.',
  'req.rescan': 'This project was connected with an older Rocket Launcher, so the code scan (native libraries, required-reason APIs, deletion path) is missing. Connect the app again to get every check.',
  'ct.title': 'Google Play closed test (12 testers × 14 days)',
  'ct.summary': '{q}/12 testers have been opted in for 14 days in a row. {left}',
  'ct.left.days': 'Earliest date to apply: {date} ({days} days left).',
  'ct.left.need': '{n} more testers needed. If they opt in today, the earliest date to apply is {date}.',
  'ct.ready': 'Ready: you can apply for production access in Play Console (Dashboard > Apply for production). The user presses the button.',
  'ct.notNeeded': 'Not required: this rule only applies to personal Play developer accounts created after 2023-11-13.',
  'ct.recorded': 'Saved {n} tester record(s) on this computer.',
  'pv.title': 'Privacy consistency check',
  'pv.summary': '{block} mismatch(es) to fix and {warn} to check across Data safety, App Privacy, PrivacyInfo.xcprivacy, permission texts and the privacy policy.',
  'pa.title': 'Google Play policy audit (Play Policy Insights)',
  'pa.summary': 'Quick scan with Google\'s Play Policy Insights rules: {n} area(s) to review. These are areas to look at, not violations. For the full audit, ask your AI agent to follow the bundled SKILL.md.',
  'pa.noAndroid': 'This app has no Android project, so the Google Play policy audit does not apply.',
  'rn.title': 'Notes for the store reviewers',
  'rn.summary': 'Review notes drafted for {stores}. Replace every [placeholder]. Never paste real passwords into chat; type them only in the console.',
  'del.title': 'Account deletion path',
  'del.ok': 'Account deletion looks complete: in-app path and web page found.',
  'del.missing': 'Account deletion is incomplete: {missing}.',
  'del.notNeeded': 'No account sign-up found, so the account deletion rule does not apply.',
  'mv.title': 'Move the app to another developer account',
  'mv.neutral': 'There are two paths: transfer the existing app, or register it again as a new app in the new account. Neither is the default. Read the differences and pick one.',
  'mv.transfer': 'Path: transfer the existing app.', 'mv.new': 'Path: register again as a new app.',
  'mv.keyRecorded': 'Saved where the signing key backup is kept (location only, no secrets).',
  'rm.title': 'Unpublish or delete an app', 'rm.summary': 'Step-by-step guide. Rocket Launcher never removes or deletes anything; the account owner does it in the console.',
  'vs.title': 'Version and build numbers', 'vs.summary': '{issues} issue(s). Suggested next version: {next}.',
  'vs.forceUpdate': 'Force-update safety: raise the server\'s minimum or latest version only after the new build is visible in every store.',
  'cc.title': 'Country rules', 'cc.summary': '{n} country rule(s) apply to this app.',
  'rc.step.t': 'Release checks before you submit', 'rc.step.d': 'Store requirements, privacy consistency and account deletion. Fix every "Must fix" item before pressing submit.',
  'rc.note': 'Release checks: {block} must fix, {warn} to check. Details: rocketlauncher_check_requirements, rocketlauncher_privacy_check, rocketlauncher_account_deletion_check.'
};
const ko = {
  'sev.block': '꼭 고칠 것', 'sev.warn': '확인 필요', 'sev.check': '콘솔에서 확인', 'sev.ok': '통과', 'sev.info': '참고',
  'req.title': '스토어 요건과 마감일',
  'req.summary': '꼭 고칠 것 {block}개 · 확인 필요 {warn}개 · 콘솔에서 확인 {check}개 · 통과 {ok}개. 규칙 확인일 {date}.',
  'req.rescan': '예전 버전으로 연결한 프로젝트라 코드 검사(네이티브 라이브러리, 필수 사유 API, 삭제 경로)가 빠져 있어요. 앱을 다시 연결하면 모든 검사를 볼 수 있어요.',
  'ct.title': 'Google Play 비공개 테스트 (테스터 12명 × 14일)',
  'ct.summary': '14일 연속 참여한 테스터 {q}/12명. {left}',
  'ct.left.days': '가장 빠른 신청일: {date} ({days}일 남음).', 'ct.left.need': '테스터가 {n}명 더 필요해요. 오늘 참여하면 가장 빠른 신청일은 {date}이에요.',
  'ct.ready': '조건 충족: Play Console 대시보드에서 프로덕션 액세스를 신청할 수 있어요. 버튼은 사용자가 직접 눌러요.',
  'ct.notNeeded': '해당 없음: 2023-11-13 이후 만든 개인 Play 개발자 계정에만 적용돼요.', 'ct.recorded': '테스터 기록 {n}건을 이 컴퓨터에 저장했어요.',
  'pv.title': '개인정보 일치 검사', 'pv.summary': '데이터 보안·App 개인정보·PrivacyInfo·권한 문구·개인정보처리방침 사이에 고칠 불일치 {block}개, 확인할 것 {warn}개.',
  'pa.title': 'Google Play 정책 점검 (Play Policy Insights)', 'pa.summary': 'Google Play Policy Insights 규칙으로 빠르게 검사했어요: 살펴볼 영역 {n}개. 위반이라는 뜻이 아니라 직접 확인해 볼 곳이에요. 전체 점검은 함께 들어 있는 SKILL.md를 AI 에이전트가 따르게 하세요.',
  'pa.noAndroid': 'Android 프로젝트가 없어서 Google Play 정책 점검은 해당하지 않아요.',
  'rn.title': '심사자에게 전할 메모', 'rn.summary': '{stores} 심사 메모 초안을 만들었어요. [대괄호] 부분을 채워 주세요. 실제 비밀번호는 채팅에 쓰지 말고 콘솔에만 입력하세요.',
  'del.title': '계정 삭제 경로', 'del.ok': '계정 삭제 경로가 갖춰져 있어요: 앱 안 경로와 웹 페이지를 찾았어요.', 'del.missing': '계정 삭제가 아직 부족해요: {missing}.', 'del.notNeeded': '회원가입 기능이 없어서 계정 삭제 규칙은 해당하지 않아요.',
  'mv.title': '다른 개발자 계정으로 앱 옮기기', 'mv.neutral': '두 가지 방법이 있어요: 기존 앱을 이전하거나, 새 계정에 새 앱으로 다시 등록하는 것. 기본값은 없어요. 차이를 보고 골라 주세요.',
  'mv.transfer': '선택: 기존 앱 이전', 'mv.new': '선택: 새 앱으로 다시 등록', 'mv.keyRecorded': '서명 키 백업 위치를 저장했어요 (위치만, 비밀 값은 저장하지 않아요).',
  'rm.title': '앱 게시 중단·삭제', 'rm.summary': '단계별 안내예요. Rocket Launcher는 아무것도 지우지 않아요. 계정 소유자가 콘솔에서 직접 해요.',
  'vs.title': '버전·빌드 번호', 'vs.summary': '문제 {issues}개. 추천 다음 버전: {next}.', 'vs.forceUpdate': '강제 업데이트 안전장치: 새 빌드가 모든 스토어에 실제로 보인 뒤에만 서버의 최소·최신 버전을 올리세요.',
  'cc.title': '국가별 규정', 'cc.summary': '이 앱에 해당하는 국가별 규정 {n}개.',
  'rc.step.t': '제출 전 출시 점검', 'rc.step.d': '스토어 요건, 개인정보 일치, 계정 삭제를 확인해요. "꼭 고칠 것"을 모두 고친 뒤 제출하세요.',
  'rc.note': '출시 점검: 꼭 고칠 것 {block}개, 확인 필요 {warn}개.'
};
const th = {
  'sev.block': 'ต้องแก้', 'sev.warn': 'ควรตรวจ', 'sev.check': 'ยืนยันในคอนโซล', 'sev.ok': 'ผ่าน', 'sev.info': 'ข้อมูล',
  'req.title': 'ข้อกำหนดและกำหนดเวลาของสโตร์', 'req.summary': 'ต้องแก้ {block} · ควรตรวจ {warn} · ยืนยันในคอนโซล {check} · ผ่าน {ok} ตรวจสอบกฎเมื่อ {date}',
  'req.rescan': 'โปรเจกต์นี้เชื่อมต่อด้วยเวอร์ชันเก่า จึงไม่มีการสแกนโค้ด เชื่อมต่อแอปอีกครั้งเพื่อดูการตรวจทั้งหมด',
  'ct.title': 'การทดสอบแบบปิดของ Google Play (ผู้ทดสอบ 12 คน × 14 วัน)', 'ct.summary': 'ผู้ทดสอบที่เข้าร่วมต่อเนื่อง 14 วัน {q}/12 คน {left}',
  'ct.left.days': 'สมัครได้เร็วที่สุด: {date} (เหลือ {days} วัน)', 'ct.left.need': 'ต้องการผู้ทดสอบเพิ่มอีก {n} คน ถ้าเข้าร่วมวันนี้ จะสมัครได้เร็วที่สุด {date}',
  'ct.ready': 'พร้อมแล้ว: สมัครสิทธิ์เผยแพร่จริงได้ใน Play Console ผู้ใช้กดปุ่มเอง', 'ct.notNeeded': 'ไม่จำเป็น: ใช้กับบัญชีนักพัฒนาส่วนตัวที่สร้างหลัง 2023-11-13 เท่านั้น', 'ct.recorded': 'บันทึกข้อมูลผู้ทดสอบ {n} รายการไว้ในเครื่องนี้แล้ว',
  'pv.title': 'ตรวจความสอดคล้องด้านความเป็นส่วนตัว', 'pv.summary': 'พบจุดไม่ตรงกันที่ต้องแก้ {block} และควรตรวจ {warn}',
  'pa.title': 'ตรวจนโยบาย Google Play (Play Policy Insights)', 'pa.summary': 'สแกนด่วนด้วยกฎ Play Policy Insights ของ Google: มี {n} ส่วนที่ควรตรวจ ซึ่งไม่ได้แปลว่าผิดนโยบาย เป็นจุดที่ควรดูเอง', 'pa.noAndroid': 'แอปนี้ไม่มีโปรเจกต์ Android จึงไม่ต้องตรวจนโยบาย Google Play',
  'rn.title': 'บันทึกสำหรับผู้ตรวจสอบของสโตร์', 'rn.summary': 'ร่างบันทึกสำหรับผู้ตรวจของ {stores} แล้ว กรุณาเติมส่วนที่อยู่ใน [วงเล็บ] และอย่าพิมพ์รหัสผ่านจริงในแชต',
  'del.title': 'ช่องทางลบบัญชี', 'del.ok': 'ช่องทางลบบัญชีครบแล้ว', 'del.missing': 'ช่องทางลบบัญชียังไม่ครบ: {missing}', 'del.notNeeded': 'ไม่พบการสมัครบัญชี จึงไม่ต้องมีช่องทางลบบัญชี',
  'mv.title': 'ย้ายแอปไปบัญชีนักพัฒนาอื่น', 'mv.neutral': 'มีสองทาง: โอนแอปเดิม หรือลงทะเบียนเป็นแอปใหม่ในบัญชีใหม่ ไม่มีค่าเริ่มต้น โปรดเลือกเอง', 'mv.transfer': 'ทางที่เลือก: โอนแอปเดิม', 'mv.new': 'ทางที่เลือก: ลงทะเบียนเป็นแอปใหม่', 'mv.keyRecorded': 'บันทึกตำแหน่งที่เก็บสำรองคีย์แล้ว (เฉพาะตำแหน่ง ไม่มีข้อมูลลับ)',
  'rm.title': 'หยุดเผยแพร่หรือลบแอป', 'rm.summary': 'คู่มือทีละขั้นตอน Rocket Launcher ไม่ลบอะไรเอง เจ้าของบัญชีทำในคอนโซล',
  'vs.title': 'หมายเลขเวอร์ชันและบิลด์', 'vs.summary': 'พบ {issues} ปัญหา เวอร์ชันถัดไปที่แนะนำ: {next}', 'vs.forceUpdate': 'ปรับเวอร์ชันขั้นต่ำบนเซิร์ฟเวอร์หลังจากบิลด์ใหม่ปรากฏในทุกสโตร์แล้วเท่านั้น',
  'cc.title': 'กฎของแต่ละประเทศ', 'cc.summary': 'มีกฎของประเทศที่เกี่ยวข้อง {n} ข้อ',
  'rc.step.t': 'ตรวจก่อนส่ง', 'rc.step.d': 'ข้อกำหนดของสโตร์ ความเป็นส่วนตัว และการลบบัญชี แก้ทุกข้อ "ต้องแก้" ก่อนกดส่ง', 'rc.note': 'การตรวจก่อนเผยแพร่: ต้องแก้ {block} ควรตรวจ {warn}'
};
const zh = {
  'sev.block': '必须修复', 'sev.warn': '需要检查', 'sev.check': '在后台确认', 'sev.ok': '通过', 'sev.info': '说明',
  'req.title': '商店要求与截止日期', 'req.summary': '必须修复 {block} 项 · 需要检查 {warn} 项 · 在后台确认 {check} 项 · 通过 {ok} 项。规则核对日期 {date}。',
  'req.rescan': '该项目由旧版本连接，缺少代码扫描。请重新连接应用以获得全部检查。',
  'ct.title': 'Google Play 封闭测试（12 名测试者 × 14 天）', 'ct.summary': '已连续参与 14 天的测试者 {q}/12 名。{left}',
  'ct.left.days': '最早可申请日期：{date}（还剩 {days} 天）。', 'ct.left.need': '还需要 {n} 名测试者。若今天加入，最早可申请日期为 {date}。',
  'ct.ready': '已满足条件：可在 Play 管理中心申请正式版访问权限，由用户自己点击按钮。', 'ct.notNeeded': '不适用：仅适用于 2023-11-13 之后创建的个人开发者账号。', 'ct.recorded': '已在本机保存 {n} 条测试者记录。',
  'pv.title': '隐私一致性检查', 'pv.summary': '发现 {block} 处需要修复、{warn} 处需要检查的不一致。',
  'pa.title': 'Google Play 政策审核（Play Policy Insights）', 'pa.summary': '使用 Google Play Policy Insights 规则快速扫描：{n} 个方面需要查看。这些是需要看一看的地方，不代表违规。', 'pa.noAndroid': '该应用没有 Android 项目，不适用 Google Play 政策审核。',
  'rn.title': '给商店审核员的说明', 'rn.summary': '已为 {stores} 起草审核说明。请填写所有 [占位内容]，不要在聊天中粘贴真实密码。',
  'del.title': '账号删除路径', 'del.ok': '账号删除路径完整。', 'del.missing': '账号删除尚不完整：{missing}。', 'del.notNeeded': '未发现注册功能，账号删除规则不适用。',
  'mv.title': '将应用移到另一个开发者账号', 'mv.neutral': '有两种方式：转移现有应用，或在新账号中重新注册为新应用。没有默认选项，请比较后选择。', 'mv.transfer': '已选：转移现有应用。', 'mv.new': '已选：重新注册为新应用。', 'mv.keyRecorded': '已保存签名密钥备份的位置（仅位置，不含机密）。',
  'rm.title': '下架或删除应用', 'rm.summary': '分步指南。Rocket Launcher 不会删除任何内容，由账号所有者在后台操作。',
  'vs.title': '版本号与构建号', 'vs.summary': '{issues} 个问题。建议的下一个版本：{next}。', 'vs.forceUpdate': '只有在新版本在所有商店都可见后，才提高服务器上的最低/最新版本。',
  'cc.title': '各国规定', 'cc.summary': '有 {n} 条国家/地区规定适用于该应用。',
  'rc.step.t': '提交前的发布检查', 'rc.step.d': '商店要求、隐私一致性和账号删除。提交前请修复所有“必须修复”项。', 'rc.note': '发布检查：必须修复 {block} 项，需要检查 {warn} 项。'
};
const hi = {
  'sev.block': 'ज़रूर ठीक करें', 'sev.warn': 'जाँचें', 'sev.check': 'कंसोल में पुष्टि करें', 'sev.ok': 'ठीक', 'sev.info': 'जानकारी',
  'req.title': 'स्टोर की ज़रूरतें और समय-सीमाएँ', 'req.summary': 'ज़रूर ठीक करें {block} · जाँचें {warn} · कंसोल में पुष्टि करें {check} · ठीक {ok}. नियम {date} को जाँचे गए।',
  'req.rescan': 'यह प्रोजेक्ट पुराने वर्ज़न से जोड़ा गया था, इसलिए कोड स्कैन नहीं है। सभी जाँचों के लिए ऐप को फिर से जोड़ें।',
  'ct.title': 'Google Play क्लोज़्ड टेस्ट (12 टेस्टर × 14 दिन)', 'ct.summary': 'लगातार 14 दिन से जुड़े टेस्टर: {q}/12. {left}',
  'ct.left.days': 'सबसे जल्दी आवेदन की तारीख: {date} ({days} दिन बाकी)।', 'ct.left.need': '{n} और टेस्टर चाहिए। अगर वे आज जुड़ें तो सबसे जल्दी आवेदन की तारीख {date} है।',
  'ct.ready': 'तैयार: Play Console में प्रोडक्शन एक्सेस के लिए आवेदन कर सकते हैं। बटन उपयोगकर्ता खुद दबाता है।', 'ct.notNeeded': 'ज़रूरी नहीं: यह नियम सिर्फ़ 2023-11-13 के बाद बने व्यक्तिगत डेवलपर खातों पर लागू होता है।', 'ct.recorded': 'इस कंप्यूटर पर {n} टेस्टर रिकॉर्ड सेव किए गए।',
  'pv.title': 'प्राइवेसी मेल जाँच', 'pv.summary': '{block} बेमेल ठीक करने हैं और {warn} जाँचने हैं।',
  'pa.title': 'Google Play नीति जाँच (Play Policy Insights)', 'pa.summary': 'Google Play Policy Insights नियमों से तेज़ स्कैन: {n} हिस्से देखने हैं। ये उल्लंघन नहीं, बस देखने लायक जगहें हैं।', 'pa.noAndroid': 'इस ऐप में Android प्रोजेक्ट नहीं है, इसलिए Google Play नीति जाँच लागू नहीं होती।',
  'rn.title': 'स्टोर रिव्यूअर के लिए नोट्स', 'rn.summary': '{stores} के लिए रिव्यू नोट्स का ड्राफ़्ट तैयार है। हर [प्लेसहोल्डर] भरें और असली पासवर्ड चैट में न लिखें।',
  'del.title': 'खाता हटाने का रास्ता', 'del.ok': 'खाता हटाने का रास्ता पूरा है।', 'del.missing': 'खाता हटाना अभी अधूरा है: {missing}।', 'del.notNeeded': 'खाता बनाने की सुविधा नहीं मिली, इसलिए यह नियम लागू नहीं होता।',
  'mv.title': 'ऐप को दूसरे डेवलपर खाते में ले जाएँ', 'mv.neutral': 'दो रास्ते हैं: मौजूदा ऐप ट्रांसफ़र करें, या नए खाते में नए ऐप के रूप में फिर से रजिस्टर करें। कोई डिफ़ॉल्ट नहीं है, अंतर देखकर चुनें।', 'mv.transfer': 'चुना गया: मौजूदा ऐप ट्रांसफ़र।', 'mv.new': 'चुना गया: नए ऐप के रूप में रजिस्टर।', 'mv.keyRecorded': 'साइनिंग की बैकअप की जगह सेव की गई (सिर्फ़ जगह, कोई गोपनीय जानकारी नहीं)।',
  'rm.title': 'ऐप अनपब्लिश या डिलीट करें', 'rm.summary': 'चरण-दर-चरण गाइड। Rocket Launcher खुद कुछ नहीं हटाता; खाता मालिक कंसोल में करता है।',
  'vs.title': 'वर्ज़न और बिल्ड नंबर', 'vs.summary': '{issues} समस्या। सुझाया गया अगला वर्ज़न: {next}।', 'vs.forceUpdate': 'सर्वर का न्यूनतम/नवीनतम वर्ज़न तभी बढ़ाएँ जब नया बिल्ड हर स्टोर में दिखने लगे।',
  'cc.title': 'देश के नियम', 'cc.summary': 'इस ऐप पर {n} देश-नियम लागू होते हैं।',
  'rc.step.t': 'सबमिट से पहले रिलीज़ जाँच', 'rc.step.d': 'स्टोर की ज़रूरतें, प्राइवेसी मेल और खाता हटाना। सबमिट से पहले हर "ज़रूर ठीक करें" ठीक करें।', 'rc.note': 'रिलीज़ जाँच: ज़रूर ठीक करें {block}, जाँचें {warn}।'
};
export const RX = { en, ko, th, zh, hi };
export function rx(L, key, vars) {
  let s = (RX[L] && RX[L][key]) || en[key] || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  return s;
}
/* Tester recruiting message, full text in every language. {app} {link} */
export const RECRUIT = {
  en: 'Hi! I\'m testing my new Android app "{app}" before it goes live on Google Play, and I need testers.\n1. Join the test: {link}\n2. Install the app from Google Play and use it a few times.\n3. Please stay in the test for at least 14 days in a row. If you leave, the 14 days start again.\nIf the link opens inside LINE, Facebook or Instagram, tap the menu and choose "Open in Chrome" (or "Open in browser") first. Feedback is welcome!',
  ko: '안녕하세요! 새 안드로이드 앱 "{app}"을(를) Google Play에 정식 출시하기 전에 테스트하고 있어서 테스터가 필요해요.\n1. 테스트 참여: {link}\n2. Google Play에서 앱을 설치하고 몇 번 사용해 주세요.\n3. 14일 연속으로 테스트에 참여한 상태를 유지해 주세요. 중간에 나가면 14일이 처음부터 다시 시작돼요.\nLINE·페이스북·인스타그램 안에서 링크가 열리면 메뉴에서 "Chrome으로 열기"(또는 "브라우저로 열기")를 먼저 눌러 주세요. 의견도 환영해요!',
  th: 'สวัสดีครับ/ค่ะ! กำลังทดสอบแอป Android ใหม่ "{app}" ก่อนเปิดตัวบน Google Play และต้องการผู้ทดสอบ\n1. เข้าร่วมการทดสอบ: {link}\n2. ติดตั้งแอปจาก Google Play แล้วลองใช้หลาย ๆ ครั้ง\n3. กรุณาอยู่ในการทดสอบต่อเนื่องอย่างน้อย 14 วัน ถ้าออกกลางคัน จะต้องนับ 14 วันใหม่\nถ้าลิงก์เปิดใน LINE, Facebook หรือ Instagram ให้กดเมนูแล้วเลือก "เปิดใน Chrome" (หรือ "เปิดในเบราว์เซอร์") ก่อน ยินดีรับฟังความคิดเห็น!',
  zh: '你好！我在 Google Play 正式发布新 Android 应用“{app}”之前进行测试，需要测试者。\n1. 加入测试：{link}\n2. 从 Google Play 安装应用并使用几次。\n3. 请连续至少 14 天保持在测试中。如果中途退出，14 天会重新计算。\n如果链接在 LINE、Facebook 或 Instagram 内打开，请先点菜单选择“在 Chrome 中打开”（或“在浏览器中打开”）。欢迎反馈！',
  hi: 'नमस्ते! मैं अपना नया Android ऐप "{app}" Google Play पर लॉन्च करने से पहले टेस्ट कर रहा/रही हूँ और मुझे टेस्टर चाहिए।\n1. टेस्ट से जुड़ें: {link}\n2. Google Play से ऐप इंस्टॉल करें और कुछ बार इस्तेमाल करें।\n3. कृपया लगातार कम से कम 14 दिन टेस्ट में बने रहें। बीच में छोड़ने पर 14 दिन फिर से शुरू होते हैं।\nअगर लिंक LINE, Facebook या Instagram के अंदर खुले, तो पहले मेन्यू में "Chrome में खोलें" (या "ब्राउज़र में खोलें") चुनें। फ़ीडबैक का स्वागत है!'
};

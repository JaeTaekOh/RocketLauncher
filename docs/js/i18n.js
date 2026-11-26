/* Intro page language: English by default. ?lang= wins, then the saved choice. */
(function () {
  var LANGS = ["en", "ko", "th", "zh", "hi"];
  var KEY = "rocketlauncher-lang";
  var T = {
    en: {
      title: "Rocket Launcher: from a finished app to the stores",
      desc: "Rocket Launcher helps you get an Android or iOS app onto Google Play and the App Store. You only pick, approve, or reject. Nothing is submitted automatically.",
      ogDesc: "From a finished app to Google Play and the App Store. You only pick, approve, or reject.",
      language: "Language",
      skip: "Skip to content",
      navSite: "Site",
      navConnect: "Connect",
      navTools: "Tools",
      navWeb: "Web version",
      kicker: "MCP server · web tool",
      lead: "From a finished app to Google Play and the App Store.<br><strong>You only pick, approve, or reject.</strong> Nothing is submitted automatically.",
      openWeb: "Open the web version",
      howToConnect: "How to connect",
      waysTitle: "Two ways to use it",
      waysBody: "Use the <a href=\"#connect\">connect instructions on this page</a> to add the MCP server to Grok Bot, Claude, Cursor, or Gemini CLI. Or open the <a href=\"app/\">web version</a> in your browser. It needs no install.",
      connectNote: "The usual install is the npm package <a href=\"https://www.npmjs.com/package/rocket-launcher-mcp\"><code class=\"i\">rocket-launcher-mcp</code></a>. You need Node.js 20 or later. To skip the install, use the <a href=\"app/\">web version</a>.",
      copy: "Copy",
      copied: "Copied",
      configHint: "Use that command in every config below.",
      aiApp: "AI app",
      askChat: "Ask in a chat",
      easiest: "Easiest",
      addYourself: "Or add it yourself",
      fieldType: "Type",
      fieldCommand: "Command",
      fieldArgs: "Arguments",
      then: "Then",
      thenBody: "Tell your bot <strong>“Help me launch my app with Rocket Launcher”</strong> and give it a public GitHub URL, or try the sample.",
      terminal: "Terminal",
      claudeDeskStep1: "<span class=\"path\">Settings<span class=\"sep\">→</span>Developer<span class=\"sep\">→</span>Edit Config</span>, then add this to <code class=\"i\">claude_desktop_config.json</code>:",
      claudeQuit: "Fully quit Claude and open it again.",
      cursorJsonStep1: "Add this to <code class=\"i\">.cursor/mcp.json</code> in your project, or to <code class=\"i\">~/.cursor/mcp.json</code> for all projects:",
      cursorApprove: "Approve the server the first time Cursor asks.",
      geminiJsonStep1: "Add this to <code class=\"i\">~/.gemini/settings.json</code> (all projects) or <code class=\"i\">.gemini/settings.json</code> in one project:",
      geminiRestart: "Restart Gemini CLI and run <code class=\"i\">/mcp</code> to see the tools.",
      fromClone: "From a clone",
      alternative: "Alternative",
      cloneHint: "If you prefer a local checkout, clone the repository, run <code class=\"i\">npm install</code> in <code class=\"i\">mcp/</code>, and use command <code class=\"i\">node</code> with the path to <code class=\"i\">mcp/server.mjs</code>.",
      after: "After that, just talk to your AI. <b>You only pick and approve.</b> You press Submit yourself in Play Console or App Store Connect. The <a href=\"app/\">web version</a> needs no install.",
      toolsTitle: "Twenty-two tools",
      tgConnect: "Connect and decide",
      ddConnectApp: "Connect an app once (public GitHub URL, folder, ZIP, or the sample) and analyze it.",
      ddGetReport: "Show launch readiness and issues that can block review.",
      ddGetDecisions: "List choices with ready-made options and a recommendation.",
      ddDecide: "Record what you actually picked or approved.",
      ddStatus: "Show the current step, the next action, and lessons learned on this computer.",
      tgCheck: "Check before you submit",
      ddCheckReq: "Check current store technical requirements and deadlines, with official sources.",
      ddPrivacy: "Cross-check privacy labels, permission texts, and the policy, and draft what is missing.",
      ddPlayAudit: "A quick Google Play policy scan with Play Policy Insights.",
      ddAccountDel: "Check in-app and web account-deletion paths when the app has sign-up.",
      ddCorrection: "Report that a check was wrong. It is overridden for this app, readiness is recalculated, and an anonymized record can be shared.",
      ddVersion: "Check version and build numbers across platforms, including force-update safety.",
      ddCountry: "Korea, EU, and Thailand rules that apply to the app. Summaries, not legal advice.",
      ddClosedTest: "Track Google Play’s 12 testers × 14 days closed-test rule.",
      ddReviewerNotes: "Draft notes for store reviewers. Placeholders only, never real passwords.",
      tgMaterials: "Make store materials",
      ddPreview: "Show icon, feature-graphic, and screenshot options so you can pick.",
      ddGenerate: "Build the full launch kit: listings, privacy pages, form answers, graphics, and a ZIP.",
      tgSubmit: "Submit (you press the button)",
      ddGuide: "Walk through each store console, with the value for every field. The last step stays locked until you approve.",
      ddApprove: "Record your approval. This does not submit anything.",
      tgAfter: "After review",
      ddReportReview: "Record submitted, rejected, resubmitted, or approved. Returns a fix plan and a reply draft when needed.",
      ddForget: "Remove one review lesson learned on this computer, only when you ask.",
      tgMove: "Move or remove an app",
      ddMove: "Compare transferring an app with registering it again.",
      ddRemove: "How to unpublish or delete an app on each store. Guide only; nothing is removed.",
      footPrivacy: "Privacy",
      footSource: "Source"
    },
    ko: {
      title: "Rocket Launcher: 만든 앱을 스토어에 올리기",
      desc: "Rocket Launcher는 Android나 iOS 앱을 Google Play와 App Store에 올리는 일을 돕습니다. 고르고, 승인하거나 거절하기만 하면 됩니다. 자동으로 제출하지 않습니다.",
      ogDesc: "만든 앱을 Google Play와 App Store에 올립니다. 고르고, 승인하거나 거절하기만 하면 됩니다.",
      language: "언어",
      skip: "본문으로 건너뛰기",
      navSite: "사이트",
      navConnect: "연결",
      navTools: "도구",
      navWeb: "웹 버전",
      kicker: "MCP 서버 · 웹 도구",
      lead: "만든 앱을 Google Play와 App Store에 올립니다.<br><strong>고르고, 승인하거나 거절하기만 하면 됩니다.</strong> 자동으로 제출하지 않습니다.",
      openWeb: "웹 버전 열기",
      howToConnect: "연결 방법",
      waysTitle: "쓰는 방법 두 가지",
      waysBody: "이 페이지의 <a href=\"#connect\">연결 안내</a>를 따라 Grok Bot, Claude, Cursor, Gemini CLI에 MCP 서버를 넣으면 됩니다. 설치하지 않고 쓰려면 브라우저에서 <a href=\"app/\">웹 버전</a>을 여세요.",
      connectNote: "보통은 npm 패키지 <a href=\"https://www.npmjs.com/package/rocket-launcher-mcp\"><code class=\"i\">rocket-launcher-mcp</code></a>로 설치합니다. Node.js 20 이상이 필요합니다. 아무것도 설치하고 싶지 않다면 <a href=\"app/\">웹 버전</a>을 쓰세요.",
      copy: "복사",
      copied: "복사됨",
      configHint: "아래 설정에는 모두 이 명령을 넣습니다.",
      aiApp: "AI 앱",
      askChat: "채팅에서 부탁하기",
      easiest: "가장 쉬움",
      addYourself: "직접 추가하기",
      fieldType: "유형",
      fieldCommand: "명령",
      fieldArgs: "인수",
      then: "그다음",
      thenBody: "봇에게 <strong>“Rocket Launcher로 앱 출시하는 걸 도와줘”</strong>라고 말하고, 공개 GitHub 주소를 주세요. 샘플로 연습해도 됩니다.",
      terminal: "터미널",
      claudeDeskStep1: "<span class=\"path\">Settings<span class=\"sep\">→</span>Developer<span class=\"sep\">→</span>Edit Config</span>에서 <code class=\"i\">claude_desktop_config.json</code>에 아래를 추가합니다:",
      claudeQuit: "Claude를 완전히 종료한 뒤 다시 엽니다.",
      cursorJsonStep1: "이 프로젝트의 <code class=\"i\">.cursor/mcp.json</code>, 또는 모든 프로젝트에 적용하려면 <code class=\"i\">~/.cursor/mcp.json</code>에 아래를 추가합니다:",
      cursorApprove: "Cursor가 처음 물을 때 서버를 승인합니다.",
      geminiJsonStep1: "모든 프로젝트는 <code class=\"i\">~/.gemini/settings.json</code>, 한 프로젝트만이면 그 안의 <code class=\"i\">.gemini/settings.json</code>에 아래를 추가합니다:",
      geminiRestart: "Gemini CLI를 다시 시작하고 <code class=\"i\">/mcp</code>를 실행하면 도구가 보입니다.",
      fromClone: "저장소를 복제한 경우",
      alternative: "다른 방법",
      cloneHint: "로컬에 받아 쓰고 싶다면 저장소를 복제한 뒤 <code class=\"i\">mcp/</code>에서 <code class=\"i\">npm install</code>을 실행하고, 명령은 <code class=\"i\">node</code>, 경로는 <code class=\"i\">mcp/server.mjs</code>를 쓰면 됩니다.",
      after: "그다음부터는 AI에게 말하기만 하면 됩니다. <b>고르고 승인하기만 하면 됩니다.</b> 제출 버튼은 Play Console이나 App Store Connect에서 직접 누릅니다. 설치하지 않고 쓰려면 <a href=\"app/\">웹 버전</a>을 쓰세요.",
      toolsTitle: "도구 22개",
      tgConnect: "연결하고 결정하기",
      ddConnectApp: "앱을 한 번 연결합니다(공개 GitHub 주소, 폴더, ZIP, 또는 샘플). 이어서 분석합니다.",
      ddGetReport: "출시 준비 상태와, 심사에서 걸릴 수 있는 문제를 보여 줍니다.",
      ddGetDecisions: "선택할 항목을 추천과 함께 보여 줍니다.",
      ddDecide: "실제로 고르거나 승인한 내용을 기록합니다.",
      ddStatus: "지금 단계, 다음에 할 일, 이 컴퓨터에 쌓인 교훈을 보여 줍니다.",
      tgCheck: "제출 전 확인",
      ddCheckReq: "스토어의 현재 기술 요건과 기한을 공식 자료와 함께 확인합니다.",
      ddPrivacy: "개인정보 라벨, 권한 문구, 개인정보 처리방침을 대조하고, 빠진 부분의 초안을 만듭니다.",
      ddPlayAudit: "Play Policy Insights로 Google Play 정책을 빠르게 살펴봅니다.",
      ddAccountDel: "회원 가입이 있는 앱이면, 앱과 웹에서 계정을 지우는 경로가 있는지 확인합니다.",
      ddCorrection: "점검이 틀렸다고 알려 줍니다. 이 앱에서는 그 항목을 덮어쓰고 준비 상태를 다시 계산하며, 익명으로 남길 수도 있습니다.",
      ddVersion: "플랫폼 사이의 버전·빌드 번호를 확인하고, 강제 업데이트도 안전한지 봅니다.",
      ddCountry: "한국, EU, 태국에서 이 앱에 해당하는 규정입니다. 요약이며 법률 자문이 아닙니다.",
      ddClosedTest: "Google Play의 테스터 12명 × 14일 비공개 테스트 규칙을 추적합니다.",
      ddReviewerNotes: "스토어 심사자를 위한 메모 초안입니다. 자리 표시만 넣고, 실제 비밀번호는 넣지 않습니다.",
      tgMaterials: "스토어 자료 만들기",
      ddPreview: "아이콘, 특집 그래픽, 스크린샷 시안을 보여 주어 고를 수 있게 합니다.",
      ddGenerate: "출시에 필요한 전체를 만듭니다. 스토어 등록정보, 개인정보 페이지, 양식 답변, 그래픽, ZIP까지요.",
      tgSubmit: "제출 (버튼은 직접 누릅니다)",
      ddGuide: "스토어 콘솔을 각 칸의 값과 함께 단계별로 안내합니다. 마지막 단계는 승인하기 전까지 잠깁니다.",
      ddApprove: "승인을 기록합니다. 이것만으로 제출되지는 않습니다.",
      tgAfter: "심사 이후",
      ddReportReview: "제출, 거절, 재제출, 승인을 기록합니다. 필요할 때 수정 계획과 답변 초안을 돌려 줍니다.",
      ddForget: "이 컴퓨터에 쌓인 심사 교훈 하나를, 요청할 때만 지웁니다.",
      tgMove: "앱 이전 또는 삭제",
      ddMove: "앱을 양도하는 것과 다시 등록하는 것을 비교합니다.",
      ddRemove: "각 스토어에서 앱 게시를 멈추거나 삭제하는 방법입니다. 안내만 하며, 실제로 지우지는 않습니다.",
      footPrivacy: "개인정보",
      footSource: "소스"
    },
    th: {
      title: "Rocket Launcher: จากแอปที่ทำเสร็จสู่สโตร์",
      desc: "Rocket Launcher ช่วยนำแอป Android หรือ iOS ขึ้น Google Play และ App Store คุณแค่เลือก อนุมัติ หรือปฏิเสธ ไม่มีการส่งอัตโนมัติ",
      ogDesc: "จากแอปที่ทำเสร็จสู่ Google Play และ App Store คุณแค่เลือก อนุมัติ หรือปฏิเสธ",
      language: "ภาษา",
      skip: "ข้ามไปยังเนื้อหา",
      navSite: "ไซต์",
      navConnect: "เชื่อมต่อ",
      navTools: "เครื่องมือ",
      navWeb: "เวอร์ชันเว็บ",
      kicker: "MCP เซิร์ฟเวอร์ · เครื่องมือเว็บ",
      lead: "จากแอปที่ทำเสร็จแล้ว สู่ Google Play และ App Store<br><strong>คุณแค่เลือก อนุมัติ หรือปฏิเสธ</strong> ไม่มีการส่งอัตโนมัติ",
      openWeb: "เปิดเวอร์ชันเว็บ",
      howToConnect: "วิธีเชื่อมต่อ",
      waysTitle: "สองวิธีในการใช้งาน",
      waysBody: "ใช้<a href=\"#connect\">คำแนะนำการเชื่อมต่อในหน้านี้</a> เพื่อเพิ่มเซิร์ฟเวอร์ MCP ให้ Grok Bot, Claude, Cursor หรือ Gemini CLI หรือเปิด<a href=\"app/\">เวอร์ชันเว็บ</a>ในเบราว์เซอร์ ไม่ต้องติดตั้ง",
      connectNote: "วิธีที่ใช้อยู่ทั่วไปคือติดตั้งแพ็กเกจ npm <a href=\"https://www.npmjs.com/package/rocket-launcher-mcp\"><code class=\"i\">rocket-launcher-mcp</code></a> ต้องใช้ Node.js 20 ขึ้นไป ถ้าไม่ต้องการติดตั้งอะไร ให้เปิด<a href=\"app/\">เวอร์ชันเว็บ</a>",
      copy: "คัดลอก",
      copied: "คัดลอกแล้ว",
      configHint: "ใช้คำสั่งนี้ในทุกการตั้งค่าด้านล่าง",
      aiApp: "แอป AI",
      askChat: "ขอในแชท",
      easiest: "ง่ายที่สุด",
      addYourself: "หรือเพิ่มเอง",
      fieldType: "ประเภท",
      fieldCommand: "คำสั่ง",
      fieldArgs: "อาร์กิวเมนต์",
      then: "จากนั้น",
      thenBody: "บอกบอทว่า <strong>“ช่วยฉันปล่อยแอปด้วย Rocket Launcher”</strong> แล้วส่ง URL ของ GitHub สาธารณะมาให้ หรือลองจากตัวอย่างก็ได้",
      terminal: "เทอร์มินัล",
      claudeDeskStep1: "ที่ <span class=\"path\">Settings<span class=\"sep\">→</span>Developer<span class=\"sep\">→</span>Edit Config</span> แล้วเพิ่มข้อความนี้ลงใน <code class=\"i\">claude_desktop_config.json</code>:",
      claudeQuit: "ปิด Claude ให้หมด แล้วเปิดใหม่",
      cursorJsonStep1: "เพิ่มข้อความนี้ลงใน <code class=\"i\">.cursor/mcp.json</code> ของโปรเจกต์ หรือ <code class=\"i\">~/.cursor/mcp.json</code> หากต้องการใช้กับทุกโปรเจกต์:",
      cursorApprove: "อนุมัติเซิร์ฟเวอร์เมื่อ Cursor ถามในครั้งแรก",
      geminiJsonStep1: "เพิ่มข้อความนี้ลงใน <code class=\"i\">~/.gemini/settings.json</code> (ทุกโปรเจกต์) หรือ <code class=\"i\">.gemini/settings.json</code> ในโปรเจกต์เดียว:",
      geminiRestart: "เริ่ม Gemini CLI ใหม่ แล้วรัน <code class=\"i\">/mcp</code> เพื่อดูเครื่องมือ",
      fromClone: "จากสำเนาในเครื่อง",
      alternative: "ทางเลือกอื่น",
      cloneHint: "ถ้าอยากใช้สำเนาในเครื่อง ให้โคลนที่เก็บ แล้วรัน <code class=\"i\">npm install</code> ใน <code class=\"i\">mcp/</code> ใช้คำสั่ง <code class=\"i\">node</code> พร้อมพาธไปยัง <code class=\"i\">mcp/server.mjs</code>",
      after: "จากนั้นก็คุยกับ AI ได้เลย <b>คุณแค่เลือกและอนุมัติ</b> กด Submit เองใน Play Console หรือ App Store Connect ถ้าไม่ต้องการติดตั้ง ให้ใช้<a href=\"app/\">เวอร์ชันเว็บ</a>",
      toolsTitle: "เครื่องมือ 22 รายการ",
      tgConnect: "เชื่อมต่อแล้วตัดสินใจ",
      ddConnectApp: "เชื่อมต่อแอปครั้งเดียว (URL ของ GitHub สาธารณะ, โฟลเดอร์, ZIP หรือตัวอย่าง) แล้ววิเคราะห์",
      ddGetReport: "แสดงความพร้อมก่อนปล่อยและปัญหาที่อาจทำให้การรีวิวสะดุด",
      ddGetDecisions: "แสดงตัวเลือกพร้อมคำแนะนำ",
      ddDecide: "บันทึกสิ่งที่คุณเลือกหรืออนุมัติจริง",
      ddStatus: "แสดงขั้นตอนปัจจุบัน สิ่งที่ต้องทำต่อไป และบทเรียนที่เก็บไว้ในเครื่องนี้",
      tgCheck: "ตรวจก่อนส่ง",
      ddCheckReq: "ตรวจข้อกำหนดทางเทคนิคและกำหนดเวลาปัจจุบันของสโตร์ พร้อมแหล่งข้อมูลทางการ",
      ddPrivacy: "เทียบป้ายความเป็นส่วนตัว ข้อความสิทธิ์ และนโยบาย แล้วร่างส่วนที่ยังขาด",
      ddPlayAudit: "สแกนนโยบาย Google Play อย่างเร็วด้วย Play Policy Insights",
      ddAccountDel: "ถ้าแอปมีสมัครสมาชิก จะตรวจเส้นทางลบบัญชีทั้งในแอปและบนเว็บ",
      ddCorrection: "แจ้งว่าการตรวจผิด รายการนั้นจะถูกแทนที่สำหรับแอปนี้ คำนวณความพร้อมใหม่ และอาจเก็บบันทึกแบบไม่ระบุตัวตน",
      ddVersion: "ตรวจเลขเวอร์ชันและบิลด์ข้ามแพลตฟอร์ม รวมถึงความปลอดภัยของการบังคับอัปเดต",
      ddCountry: "กฎของเกาหลี สหภาพยุโรป และไทยที่ใช้กับแอปนี้ เป็นบทสรุป ไม่ใช่คำปรึกษาทางกฎหมาย",
      ddClosedTest: "ติดตามกฎการทดสอบแบบปิดของ Google Play คือผู้ทดสอบ 12 คน × 14 วัน",
      ddReviewerNotes: "ร่างบันทึกสำหรับผู้รีวิวของสโตร์ ใส่ตัวแทนข้อความเท่านั้น ไม่ใส่รหัสผ่านจริง",
      tgMaterials: "ทำข้อมูลสำหรับสโตร์",
      ddPreview: "แสดงตัวเลือกไอคอน ภาพโปรโมต และภาพหน้าจอ ให้คุณเลือก",
      ddGenerate: "ทำชุดปล่อยทั้งหมด: ข้อมูลลงสโตร์ หน้าความเป็นส่วนตัว คำตอบในแบบฟอร์ม ภาพกราฟิก และไฟล์ ZIP",
      tgSubmit: "ส่ง (คุณกดปุ่มเอง)",
      ddGuide: "พาเดินในคอนโซลของแต่ละสโตร์ พร้อมค่าที่จะใส่ในแต่ละช่อง ขั้นตอนสุดท้ายจะล็อกไว้จนกว่าคุณจะอนุมัติ",
      ddApprove: "บันทึกการอนุมัติของคุณ การทำเช่นนี้ไม่ได้ส่งอะไรให้สโตร์",
      tgAfter: "หลังการรีวิว",
      ddReportReview: "บันทึกว่าส่งแล้ว ถูกปฏิเสธ ส่งใหม่ หรือได้รับการอนุมัติ เมื่อจำเป็นจะได้แผนแก้และร่างคำตอบ",
      ddForget: "ลบบทเรียนจากการรีวิวที่เก็บในเครื่องนี้ออกหนึ่งรายการ เฉพาะเมื่อคุณขอ",
      tgMove: "ย้ายหรือนำแอปออก",
      ddMove: "เปรียบเทียบการโอนแอปกับการลงทะเบียนใหม่",
      ddRemove: "วิธีหยุดเผยแพร่หรือลบแอปในแต่ละสโตร์ เป็นเพียงคำแนะนำ ไม่ได้ลบอะไรให้",
      footPrivacy: "ความเป็นส่วนตัว",
      footSource: "ซอร์ส"
    },
    zh: {
      title: "Rocket Launcher：把做好的应用上架",
      desc: "Rocket Launcher 帮你把 Android 或 iOS 应用上架到 Google Play 和 App Store。你只需选择、同意或拒绝。不会自动提交。",
      ogDesc: "把做好的应用上架到 Google Play 和 App Store。你只需选择、同意或拒绝。",
      language: "语言",
      skip: "跳到正文",
      navSite: "网站",
      navConnect: "连接",
      navTools: "工具",
      navWeb: "网页版",
      kicker: "MCP 服务器 · 网页工具",
      lead: "把做好的应用上架到 Google Play 和 App Store。<br><strong>你只需选择、同意或拒绝。</strong>不会自动提交。",
      openWeb: "打开网页版",
      howToConnect: "如何连接",
      waysTitle: "两种用法",
      waysBody: "按本页的<a href=\"#connect\">连接说明</a>，把 MCP 服务器加到 Grok Bot、Claude、Cursor 或 Gemini CLI。或者直接在浏览器打开<a href=\"app/\">网页版</a>，不用安装。",
      connectNote: "通常安装的是 npm 包 <a href=\"https://www.npmjs.com/package/rocket-launcher-mcp\"><code class=\"i\">rocket-launcher-mcp</code></a>。需要 Node.js 20 或更高版本。不想安装的话，请打开<a href=\"app/\">网页版</a>。",
      copy: "复制",
      copied: "已复制",
      configHint: "下面的每项配置都用这条命令。",
      aiApp: "AI 应用",
      askChat: "在对话里请它帮忙",
      easiest: "最简单",
      addYourself: "或者自己添加",
      fieldType: "类型",
      fieldCommand: "命令",
      fieldArgs: "参数",
      then: "然后",
      thenBody: "对 Bot 说<strong>“用 Rocket Launcher 帮我上架应用”</strong>，并给出公开的 GitHub 地址。也可以先用示例试试。",
      terminal: "终端",
      claudeDeskStep1: "打开 <span class=\"path\">Settings<span class=\"sep\">→</span>Developer<span class=\"sep\">→</span>Edit Config</span>，然后把下面的内容加到 <code class=\"i\">claude_desktop_config.json</code>：",
      claudeQuit: "完全退出 Claude，再重新打开。",
      cursorJsonStep1: "把下面的内容加到项目里的 <code class=\"i\">.cursor/mcp.json</code>，或加到 <code class=\"i\">~/.cursor/mcp.json</code> 以便用于所有项目：",
      cursorApprove: "Cursor 第一次询问时，批准该服务器。",
      geminiJsonStep1: "把下面的内容加到 <code class=\"i\">~/.gemini/settings.json</code>（所有项目），或加到某个项目里的 <code class=\"i\">.gemini/settings.json</code>：",
      geminiRestart: "重启 Gemini CLI，运行 <code class=\"i\">/mcp</code> 即可看到工具。",
      fromClone: "从本地克隆使用",
      alternative: "另一种方式",
      cloneHint: "如果想在本地使用，请克隆代码库，在 <code class=\"i\">mcp/</code> 中运行 <code class=\"i\">npm install</code>，命令用 <code class=\"i\">node</code>，路径指向 <code class=\"i\">mcp/server.mjs</code>。",
      after: "之后直接跟 AI 说就行。<b>你只需选择并同意。</b>在 Play Console 或 App Store Connect 里由你自己点提交。不想安装的话，请用<a href=\"app/\">网页版</a>。",
      toolsTitle: "22 项工具",
      tgConnect: "连接并做决定",
      ddConnectApp: "为应用连接一次（公开 GitHub 地址、文件夹、ZIP 或示例），然后进行分析。",
      ddGetReport: "显示上架准备情况，以及可能卡住审核的问题。",
      ddGetDecisions: "列出可选项，并附上推荐。",
      ddDecide: "记录你实际选择或同意的内容。",
      ddStatus: "显示当前步骤、下一步，以及这台电脑上留下的经验。",
      tgCheck: "提交前检查",
      ddCheckReq: "对照官方来源，检查商店当前的技术要求和截止日期。",
      ddPrivacy: "核对隐私标签、权限说明和隐私政策，并起草缺少的部分。",
      ddPlayAudit: "用 Play Policy Insights 快速查看 Google Play 政策。",
      ddAccountDel: "如果应用有注册，检查应用内和网页上的账户删除路径。",
      ddCorrection: "指出某项检查有误。该应用会覆盖该项并重新计算准备情况，也可以留下匿名记录。",
      ddVersion: "检查各平台的版本号和构建号，也包括强制更新是否安全。",
      ddCountry: "适用于该应用的韩国、欧盟和泰国规定。仅是摘要，不是法律意见。",
      ddClosedTest: "跟踪 Google Play「12 名测试人员 × 14 天」的封闭测试规则。",
      ddReviewerNotes: "起草给商店审核人员的备注。只放占位内容，绝不放真实密码。",
      tgMaterials: "制作商店资料",
      ddPreview: "展示图标、特色图片和截图方案，供你挑选。",
      ddGenerate: "生成完整的上架材料：商品详情、隐私页面、表单答复、图片，以及 ZIP。",
      tgSubmit: "提交（按钮由你来按）",
      ddGuide: "按步骤引导你走完各商店后台，并给出每一栏要填的值。最后一步在你同意之前会保持锁定。",
      ddApprove: "记录你的同意。仅此一步并不会提交任何内容。",
      tgAfter: "审核之后",
      ddReportReview: "记录已提交、被拒、再次提交或已通过。需要时会给出修改计划和回复草稿。",
      ddForget: "按你的要求，删除这台电脑上留下的一条审核经验。",
      tgMove: "转移或下架应用",
      ddMove: "比较转让应用和重新注册。",
      ddRemove: "说明如何在各商店取消发布或删除应用。仅提供指引，不会替你删除。",
      footPrivacy: "隐私",
      footSource: "源码"
    },
    hi: {
      title: "Rocket Launcher: बने ऐप को स्टोर तक",
      desc: "Rocket Launcher Android या iOS ऐप को Google Play और App Store पर ले जाने में मदद करता है। आप केवल चुनें, मंज़ूर करें, या अस्वीकार करें। कुछ भी अपने आप सबमिट नहीं होता।",
      ogDesc: "बने ऐप को Google Play और App Store तक ले जाएँ। आप केवल चुनें, मंज़ूर करें, या अस्वीकार करें।",
      language: "भाषा",
      skip: "मुख्य सामग्री पर जाएँ",
      navSite: "साइट",
      navConnect: "कनेक्ट",
      navTools: "टूल",
      navWeb: "वेब वर्शन",
      kicker: "MCP सर्वर · वेब टूल",
      lead: "बने हुए ऐप को Google Play और App Store तक ले जाएँ।<br><strong>आप केवल चुनें, मंज़ूर करें, या अस्वीकार करें।</strong> कुछ भी अपने आप सबमिट नहीं होता।",
      openWeb: "वेब वर्शन खोलें",
      howToConnect: "कनेक्ट कैसे करें",
      waysTitle: "इस्तेमाल के दो तरीके",
      waysBody: "इस पेज के <a href=\"#connect\">कनेक्ट निर्देश</a> से MCP सर्वर को Grok Bot, Claude, Cursor, या Gemini CLI में जोड़ें। या ब्राउज़र में <a href=\"app/\">वेब वर्शन</a> खोलें। इंस्टॉल की ज़रूरत नहीं।",
      connectNote: "आम तौर पर npm पैकेज <a href=\"https://www.npmjs.com/package/rocket-launcher-mcp\"><code class=\"i\">rocket-launcher-mcp</code></a> से इंस्टॉल किया जाता है। Node.js 20 या उसके बाद का वर्शन चाहिए। कुछ भी इंस्टॉल नहीं करना हो तो <a href=\"app/\">वेब वर्शन</a> खोलें।",
      copy: "कॉपी",
      copied: "कॉपी हो गया",
      configHint: "नीचे दी गई हर कॉन्फ़िग में यही कमांड इस्तेमाल करें।",
      aiApp: "AI ऐप",
      askChat: "चैट में कहें",
      easiest: "सबसे आसान",
      addYourself: "या खुद जोड़ें",
      fieldType: "प्रकार",
      fieldCommand: "कमांड",
      fieldArgs: "आर्गुमेंट",
      then: "उसके बाद",
      thenBody: "बॉट से कहें <strong>“Rocket Launcher से मेरा ऐप लॉन्च करने में मदद करो”</strong> और उसे एक सार्वजनिक GitHub URL दें, या सैंपल आज़माएँ।",
      terminal: "टर्मिनल",
      claudeDeskStep1: "<span class=\"path\">Settings<span class=\"sep\">→</span>Developer<span class=\"sep\">→</span>Edit Config</span> खोलें, फिर इसे <code class=\"i\">claude_desktop_config.json</code> में जोड़ें:",
      claudeQuit: "Claude को पूरी तरह बंद करें, फिर फिर से खोलें।",
      cursorJsonStep1: "इसे अपने प्रोजेक्ट के <code class=\"i\">.cursor/mcp.json</code> में जोड़ें, या सभी प्रोजेक्ट के लिए <code class=\"i\">~/.cursor/mcp.json</code> में:",
      cursorApprove: "Cursor पहली बार पूछे तो सर्वर को मंज़ूर करें।",
      geminiJsonStep1: "इसे <code class=\"i\">~/.gemini/settings.json</code> (सभी प्रोजेक्ट) या एक प्रोजेक्ट के <code class=\"i\">.gemini/settings.json</code> में जोड़ें:",
      geminiRestart: "Gemini CLI को फिर से चलाएँ और टूल देखने के लिए <code class=\"i\">/mcp</code> चलाएँ।",
      fromClone: "क्लोन से इस्तेमाल",
      alternative: "दूसरा तरीका",
      cloneHint: "अगर लोकल कॉपी इस्तेमाल करनी हो तो रिपॉज़िटरी क्लोन करें, <code class=\"i\">mcp/</code> में <code class=\"i\">npm install</code> चलाएँ, और कमांड <code class=\"i\">node</code> के साथ <code class=\"i\">mcp/server.mjs</code> का पथ दें।",
      after: "इसके बाद बस अपनी AI से बात करें। <b>आप केवल चुनें और मंज़ूर करें।</b> Submit आप खुद Play Console या App Store Connect में दबाएँ। कुछ भी इंस्टॉल नहीं करना हो तो <a href=\"app/\">वेब वर्शन</a> इस्तेमाल करें।",
      toolsTitle: "22 टूल",
      tgConnect: "कनेक्ट करें और फ़ैसला लें",
      ddConnectApp: "ऐप को एक बार कनेक्ट करें (सार्वजनिक GitHub URL, फ़ोल्डर, ZIP, या सैंपल) और उसका विश्लेषण करें।",
      ddGetReport: "लॉन्च की तैयारी और वे समस्याएँ दिखाएँ जो समीक्षा रोक सकती हैं।",
      ddGetDecisions: "विकल्प और एक सिफ़ारिश के साथ सूची दिखाएँ।",
      ddDecide: "आपने वास्तव में जो चुना या मंज़ूर किया, उसे दर्ज करें।",
      ddStatus: "मौजूदा चरण, अगला काम, और इस कंप्यूटर पर सीखी गई बातें दिखाएँ।",
      tgCheck: "सबमिट करने से पहले जाँच",
      ddCheckReq: "स्टोर की मौजूदा तकनीकी ज़रूरतें और समय-सीमा आधिकारिक स्रोतों के साथ जाँचें।",
      ddPrivacy: "गोपनीयता लेबल, अनुमति के पाठ और नीति का मिलान करें, और जो कमी हो उसका मसौदा बनाएँ।",
      ddPlayAudit: "Play Policy Insights से Google Play नीति की तेज़ जाँच।",
      ddAccountDel: "अगर ऐप में साइन-अप है, तो ऐप और वेब पर खाता हटाने के रास्ते जाँचें।",
      ddCorrection: "बताएँ कि कोई जाँच गलत थी। इस ऐप के लिए वह बात ओवरराइड होती है, तैयारी फिर से गिनी जाती है, और एक अनाम रिकॉर्ड साझा किया जा सकता है।",
      ddVersion: "प्लेटफ़ॉर्म के आर-पार वर्शन और बिल्ड नंबर जाँचें, ज़बरदस्ती अपडेट की सुरक्षा सहित।",
      ddCountry: "इस ऐप पर लागू कोरिया, EU और थाईलैंड के नियम। सारांश हैं, कानूनी सलाह नहीं।",
      ddClosedTest: "Google Play के 12 टेस्टर × 14 दिन के बंद टेस्ट नियम पर नज़र रखें।",
      ddReviewerNotes: "स्टोर समीक्षकों के लिए नोट का मसौदा। केवल प्लेसहोल्डर, असली पासवर्ड कभी नहीं।",
      tgMaterials: "स्टोर सामग्री बनाएँ",
      ddPreview: "आइकन, फ़ीचर ग्राफ़िक और स्क्रीनशॉट के विकल्प दिखाएँ, ताकि आप चुन सकें।",
      ddGenerate: "पूरी लॉन्च किट बनाएँ: लिस्टिंग, गोपनीयता पेज, फ़ॉर्म के जवाब, ग्राफ़िक्स, और एक ZIP।",
      tgSubmit: "सबमिट (बटन आप दबाएँ)",
      ddGuide: "हर स्टोर कंसोल में, हर फ़ील्ड की वैल्यू के साथ, चरणबद्ध तरीक़े से ले चलें। आखिरी चरण आपके मंज़ूर करने तक बंद रहता है।",
      ddApprove: "आपकी मंज़ूरी दर्ज करें। इससे कुछ सबमिट नहीं होता।",
      tgAfter: "समीक्षा के बाद",
      ddReportReview: "सबमिट, अस्वीकृत, फिर से सबमिट, या मंज़ूर दर्ज करें। ज़रूरत हो तो सुधार योजना और जवाब का मसौदा मिलता है।",
      ddForget: "इस कंप्यूटर पर सीखी गई एक समीक्षा बात हटाएँ, केवल जब आप कहें।",
      tgMove: "ऐप स्थानांतरित करें या हटाएँ",
      ddMove: "ऐप ट्रांसफ़र करने और उसे फिर से पंजीकृत करने की तुलना करें।",
      ddRemove: "हर स्टोर पर ऐप को अनपब्लिश या हटाने का तरीका। केवल गाइड; कुछ हटाया नहीं जाता।",
      footPrivacy: "गोपनीयता",
      footSource: "सोर्स"
    }
  };

  function valid(l) { return LANGS.indexOf(l) >= 0 ? l : null; }
  function stored() { try { return valid(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save(l) { try { localStorage.setItem(KEY, l); } catch (e) {} }
  function fromUrl() {
    try { return valid((new URLSearchParams(location.search).get("lang") || "").toLowerCase()); }
    catch (e) { return null; }
  }
  function t(key) {
    var d = T[current] || T.en;
    return (d && d[key]) || (T.en && T.en[key]) || key;
  }

  function apply(l) {
    var d = T[l] || T.en;
    document.documentElement.lang = l === "zh" ? "zh-Hans" : l;
    document.documentElement.setAttribute("data-lang", l);
    document.title = d.title;
    var m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", d.desc);
    ["og:description", "twitter:description"].forEach(function (name) {
      var n = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
      if (n) n.setAttribute("content", d.ogDesc);
    });
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute("data-i18n");
      if (d[k]) nodes[i].textContent = d[k];
    }
    var htmlNodes = document.querySelectorAll("[data-i18n-html]");
    for (var h = 0; h < htmlNodes.length; h++) {
      var hk = htmlNodes[h].getAttribute("data-i18n-html");
      if (d[hk]) htmlNodes[h].innerHTML = d[hk];
    }
    var nav = document.querySelector(".lang");
    if (nav) nav.setAttribute("aria-label", d.language);
    var siteNav = document.querySelector(".nav");
    if (siteNav) siteNav.setAttribute("aria-label", d.navSite);
    var ariaNodes = document.querySelectorAll("[data-i18n-aria]");
    for (var a = 0; a < ariaNodes.length; a++) {
      var ak = ariaNodes[a].getAttribute("data-i18n-aria");
      if (d[ak]) ariaNodes[a].setAttribute("aria-label", d[ak]);
    }
    var copies = document.querySelectorAll(".copy");
    for (var c = 0; c < copies.length; c++) {
      copies[c].setAttribute("aria-label", d.copy);
      var label = copies[c].querySelector(".t");
      if (label && !copies[c].classList.contains("ok")) label.textContent = d.copy;
    }
    var btns = document.querySelectorAll(".lang button");
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute("aria-pressed", btns[j].getAttribute("data-lang") === l ? "true" : "false");
    }
  }

  var urlLang = fromUrl();
  var current = urlLang || stored() || "en";
  if (urlLang) save(urlLang);
  apply(current);

  window.RLSiteI18n = {
    t: t,
    get lang() { return current; }
  };

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".lang button[data-lang]") : null;
    if (!b) return;
    var l = valid(b.getAttribute("data-lang"));
    if (!l || l === current) return;
    current = l;
    save(l);
    apply(l);
    try {
      var u = new URL(location.href);
      if (u.searchParams.has("lang")) {
        if (l === "en") u.searchParams.delete("lang");
        else u.searchParams.set("lang", l);
        history.replaceState(null, "", u.pathname + u.search + u.hash);
      }
    } catch (err) {}
  });
})();

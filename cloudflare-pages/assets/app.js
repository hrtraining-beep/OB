const LIFF_ID = '2010372532-0i3JE94q';
    const LINE_LOGIN_CHANNEL_ID = '2010372532';
    const API_BASE = 'https://nose-tea-onboarding-api.hrtraining.workers.dev';
    const OA_BASIC_ID = '@103ofaap';
    const OA_DISPLAY_NAME = 'Nose Tea Care';
    const OA_ADD_URL = 'https://line.me/R/ti/p/' + OA_BASIC_ID;
    let lineProfile = null;
    let idToken = '';
    let currentUser = null;
    let adminCache = null;
    // HR live-refresh (silent background poll → "new data" pill). Set per-view via markHrView(); cleared in render().
    let hrViewReload = null, hrPollTimer = null, hrLastSig = '', hrPendingData = null, hrPolling = false;
    let currentTasks = [];
    let currentPortalMeta = {};
    let portalPreviewMode = false; // true when HR is previewing a Mentee/Mentor portal — so goPortal keeps the "กลับ Admin" banner
    let portalTab = 'home';
    let pendingMessageUserId = '';
    let obFeedbackLabels = null; // HR-editable captions for OB Feedback score buttons (null = defaults)
    let webSessionToken = localStorage.getItem('noseTeaWebSession') || '';

    const CP1252_EXTRA_BYTES = {
      '€': 0x80,
      '‚': 0x82,
      'ƒ': 0x83,
      '„': 0x84,
      '…': 0x85,
      '†': 0x86,
      '‡': 0x87,
      'ˆ': 0x88,
      '‰': 0x89,
      'Š': 0x8A,
      '‹': 0x8B,
      'Œ': 0x8C,
      'Ž': 0x8E,
      '‘': 0x91,
      '’': 0x92,
      '“': 0x93,
      '”': 0x94,
      '•': 0x95,
      '–': 0x96,
      '—': 0x97,
      '˜': 0x98,
      '™': 0x99,
      'š': 0x9A,
      '›': 0x9B,
      'œ': 0x9C,
      'ž': 0x9E,
      'Ÿ': 0x9F
    };

    const KNOWN_TEXT_REPLACEMENTS = [
      ['Â·', ' · '],
      ['âœ“', '✓'],
      ['â˜…', '★'],
      ['âœŽ', '✎'],
      ['ðŸ ', '🏠'],
      ['ðŸ“‹', '📋'],
      ['ðŸ‘¥', '👥'],
      ['ðŸ‘¤', '👤'],
      ['ðŸ—º', '🗺'],
      ['ðŸ“…', '🗓'],
      ['ðŸ“š', '📚'],
      ['à¹€à¸”à¸·à¸­à¸™à¸™à¸µà¹‰', 'เดือนนี้'],
      ['à¹€à¸›à¸´à¸”à¸œà¹ˆà¸²à¸™à¹€à¸§à¹‡à¸šà¸šà¸£à¸²à¸§à¹€à¸‹à¸­à¸£à¹Œ', 'เปิดผ่านเว็บบราวเซอร์'],
      ['à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡à¸œà¹ˆà¸²à¸™ LINE LIFF à¹€à¸žà¸·à¹ˆà¸­à¸”à¸±à¸ LINE UserID à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´', 'หน้านี้ใช้งานจริงผ่าน LINE LIFF เพื่อดึง LINE UserID อัตโนมัติ'],
      ['à¸ªà¸³à¸«à¸£à¸±à¸š HR/Admin à¸ªà¸²à¸¡à¸²à¸£à¸– login à¸œà¹ˆà¸²à¸™ LINE Login à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸Šà¹‰ dashboard à¸šà¸™à¹€à¸§à¹‡à¸šà¹„à¸”à¹‰', 'สำหรับ HR/Admin สามารถ login ผ่าน LINE Login เพื่อใช้ dashboard บนเว็บได้'],
      ['Login HR Admin à¸”à¹‰à¸§à¸¢ LINE', 'Login HR Admin ด้วย LINE'],
      ['à¹€à¸›à¸´à¸”à¸œà¹ˆà¸²à¸™ LINE LIFF', 'เปิดผ่าน LINE LIFF'],
      ['Preview Mentor à¸šà¸™à¹€à¸§à¹‡à¸š', 'Preview Mentor บนเว็บ'],
      ['Preview Mentee à¸šà¸™à¹€à¸§à¹‡à¸š', 'Preview Mentee บนเว็บ'],
      ['à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š API...', 'กำลังตรวจสอบ API...'],
      ['à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¹€à¸‚à¹‰à¸²à¹ƒà¸Šà¹‰à¸‡à¸²à¸™', 'ลงทะเบียนเข้าใช้งาน'],
      ['à¸¢à¸·à¸™à¸¢à¸±à¸™ LINE à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'ยืนยัน LINE สำเร็จ'],
      ['à¸Šà¸·à¹ˆà¸­à¹ƒà¸™ LINE:', 'ชื่อใน LINE:'],
      ['à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥', 'ชื่อ-นามสกุล'],
      ['à¹€à¸Šà¹ˆà¸™ Kitti P.', 'เช่น Kitti P.'],
      ['à¹à¸œà¸™à¸', 'แผนก'],
      ['à¹€à¸Šà¹ˆà¸™ Operations, Marketing, HR', 'เช่น Operations, Marketing, HR'],
      ['à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡', 'ตำแหน่ง'],
      ['à¹€à¸Šà¹ˆà¸™ Store Manager', 'เช่น Store Manager'],
      ['à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸¥à¸°à¸œà¸¹à¸à¸šà¸±à¸à¸Šà¸µ LINE', 'บันทึกและผูกบัญชี LINE'],
      ['à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸...', 'กำลังบันทึก...'],
      ['à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³', 'ยังไม่มีงานที่ต้องทำ'],
      ['à¸žà¸·à¹‰à¸™à¸—à¸µà¹ˆà¸™à¸µà¹‰à¹€à¸•à¸£à¸µà¸¢à¸¡à¹„à¸§à¹‰à¸ªà¸³à¸«à¸£à¸±à¸šà¸„à¸¹à¹ˆà¸¡à¸·à¸­ à¸§à¸´à¸”à¸µà¹‚à¸­ à¸«à¸£à¸·à¸­à¹€à¸­à¸à¸ªà¸²à¸£à¹€à¸£à¸µà¸¢à¸™à¸£à¸¹à¹‰à¸‚à¸­à¸‡à¹à¸•à¹ˆà¸¥à¸°à¹€à¸”à¸·à¸­à¸™', 'พื้นที่นี้เตรียมไว้สำหรับคู่มือ วิดีโอ หรือเอกสารเรียนรู้ของแต่ละเดือน'],
      ['à¸”à¸¹à¸‡à¸²à¸™à¸›à¸£à¸°à¹€à¸¡à¸´à¸™ à¸ªà¹ˆà¸‡ feedback à¹à¸¥à¸°à¸•à¸´à¸”à¸•à¸²à¸¡ mentee à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¸¡à¸­à¸šà¸«à¸¡à¸²à¸¢', 'ดูงานประเมิน ส่ง feedback และติดตาม mentee ที่ได้รับมอบหมาย'],
      ['à¸•à¸´à¸”à¸•à¸²à¸¡ checkpoint, session à¹à¸¥à¸° reflection à¹ƒà¸™à¹€à¸ªà¹‰à¸™à¸—à¸²à¸‡ onboarding', 'ติดตาม checkpoint, session และ reflection ในเส้นทาง onboarding'],
      ['à¹‚à¸«à¸¡à¸” Preview à¸ªà¸³à¸«à¸£à¸±à¸š Admin', 'โหมด Preview สำหรับ Admin'],
      ['à¸à¸¥à¸±à¸š Admin', 'กลับ Admin'],
      ['à¹€à¸”à¸·à¸­à¸™', 'เดือน'],
      ['à¸£à¸­à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£', 'รอดำเนินการ'],
      ['à¹€à¸ªà¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§', 'เสร็จแล้ว'],
      ['à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š Progress', 'ตรวจสอบ Progress'],
      ['à¹ƒà¸«à¹‰ Feedback', 'ให้ Feedback'],
      ['à¹€à¸›à¸´à¸”à¸‡à¸²à¸™', 'เปิดงาน'],
      ['à¸à¸£à¸­à¸ Reflection', 'กรอก Reflection'],
      ['à¸¢à¸·à¸™à¸¢à¸±à¸™', 'ยืนยัน'],
      ['à¸£à¸­à¹ƒà¸«à¹‰ Feedback', 'รอให้ Feedback'],
      ['à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸£à¹ˆà¸§à¸¡', 'ยืนยันการเข้าร่วม'],
      ['à¸–à¸¶à¸‡à¹€à¸§à¸¥à¸²à¸ªà¹ˆà¸‡ Reflection', 'ถึงเวลาส่ง Reflection'],
      ['à¹€à¸•à¹‡à¸¡à¸§à¸±à¸™', 'เต็มวัน'],
      ['1 à¸‡à¸²à¸™', '1 งาน'],
      ['à¸›à¸£à¸°à¹€à¸ à¸—', 'ประเภท'],
      ['à¸ˆà¸³à¸™à¸§à¸™', 'จำนวน'],
      ['à¸à¸³à¸«à¸™à¸”à¸ªà¹ˆà¸‡', 'กำหนดส่ง'],
      ['à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”', 'รายละเอียด'],
      ['à¸ªà¸–à¸²à¸™à¸°', 'สถานะ'],
      ['à¸”à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”', 'ดูรายละเอียด'],
      ['à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”', 'ทั้งหมด'],
      ['à¸„à¹‰à¸²à¸‡à¸­à¸¢à¸¹à¹ˆ', 'ค้างอยู่'],
      ['à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ task à¸ªà¸³à¸«à¸£à¸±à¸š progress', 'ยังไม่มี task สำหรับ progress'],
      ['à¸à¸¥à¸±à¸šà¸«à¸™à¹‰à¸²à¸«à¸¥à¸±à¸', 'กลับหน้าหลัก'],
      ['à¸‚à¹‰à¸­à¹€à¸ªà¸™à¸­à¹à¸™à¸°à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡', 'ข้อเสนอแนะเพิ่มเติม'],
      ['à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¹„à¸”à¹‰à¹€à¸£à¸µà¸¢à¸™à¸£à¸¹à¹‰', 'สิ่งที่ได้เรียนรู้'],
      ['à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸—à¹‰à¸²à¸—à¸²à¸¢', 'สิ่งที่ยังท้าทาย'],
      ['à¸‚à¹‰à¸­à¹€à¸ªà¸™à¸­à¹à¸™à¸°', 'ข้อเสนอแนะ'],
      ['à¸­à¸¢à¸²à¸à¹ƒà¸«à¹‰à¸—à¸µà¸¡à¸Šà¹ˆà¸§à¸¢à¸­à¸°à¹„à¸£à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡', 'อยากให้ทีมช่วยอะไรเพิ่มเติม'],
      ['à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸£à¹ˆà¸§à¸¡ session à¸™à¸µà¹‰', 'ยืนยันการเข้าร่วม session นี้'],
      ['à¸§à¸±à¸™à¸—à¸µà¹ˆ:', 'วันที่:'],
      ['à¹€à¸§à¸¥à¸²:', 'เวลา:'],
      ['à¸«à¹‰à¸­à¸‡:', 'ห้อง:'],
      ['à¹€à¸›à¹‰à¸²à¸«à¸¡à¸²à¸¢', 'เป้าหมาย'],
      ['à¸ªà¹ˆà¸‡à¹à¸¥à¹‰à¸§', 'ส่งแล้ว'],
      ['Preview mode: à¸Ÿà¸­à¸£à¹Œà¸¡à¸™à¸µà¹‰à¸«à¸™à¹‰à¸²à¸•à¸²à¹€à¸«à¸¡à¸·à¸­à¸™à¸ˆà¸£à¸´à¸‡ à¹à¸•à¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥', 'Preview mode: ฟอร์มนี้หน้าตาเหมือนจริง แต่ยังไม่บันทึกข้อมูล'],
      ['à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'บันทึกสำเร็จ'],
      ['à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸” Admin Dashboard...', 'กำลังโหลด Admin Dashboard...'],
      ['à¸ˆà¸±à¸”à¸à¸²à¸£ session, tasks, notifications, templates à¹à¸¥à¸° progress à¸—à¸±à¹‰à¸‡à¸£à¸°à¸šà¸š', 'จัดการ session, tasks, notifications, templates และ progress ทั้งระบบ'],
      ['à¸ªà¹ˆà¸‡à¸à¸²à¸£à¹Œà¸” ', 'ส่งการ์ด '],
      [' à¹€à¸‚à¹‰à¸² LINE à¸‚à¸­à¸‡à¸„à¸¸à¸“à¹à¸¥à¹‰à¸§', ' เข้า LINE ของคุณแล้ว'],
      ['à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ mentee à¸—à¸µà¹ˆà¸–à¸¹à¸ assign', 'ยังไม่มี mentee ที่ถูก assign'],
      ['à¹€à¸¡à¸·à¹ˆà¸­à¸ªà¸£à¹‰à¸²à¸‡ group à¹à¸¥à¸° assign mentor à¹à¸¥à¹‰à¸§ à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸ˆà¸°à¸‚à¸¶à¹‰à¸™à¸—à¸µà¹ˆà¸™à¸µà¹ˆà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´', 'เมื่อสร้าง group และ assign mentor แล้ว รายชื่อจะขึ้นที่นี่อัตโนมัติ'],
      ['à¹€à¸Šà¹ˆà¸™ OB June Week 4', 'เช่น OB June Week 4'],
      ['à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸¥à¸¸à¹ˆà¸¡ onboarding', 'ยังไม่มีกลุ่ม onboarding'],
      ['à¸à¸” Ctrl/Command à¹€à¸žà¸·à¹ˆà¸­à¹€à¸¥à¸·à¸­à¸à¸«à¸¥à¸²à¸¢à¸„à¸™', 'กด Ctrl/Command เพื่อเลือกหลายคน'],
      ['à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ Session à¸—à¸µà¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¹„à¸§à¹‰', 'ยังไม่มี Session ที่สร้างไว้'],
      ['à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¸ˆà¸²à¸ Nose Tea Onboarding: à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸‡à¸²à¸™à¸‚à¸­à¸‡à¸„à¸¸à¸“à¹ƒà¸™ LIFF', 'แจ้งเตือนจาก Nose Tea Onboarding: กรุณาตรวจสอบงานของคุณใน LIFF'],
      ['à¸à¸£à¸¸à¸“à¸²à¹€à¸›à¸´à¸” LIFF à¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸‡à¸²à¸™ onboarding à¸‚à¸­à¸‡à¸„à¸¸à¸“', 'กรุณาเปิด LIFF เพื่อตรวจสอบงาน onboarding ของคุณ'],
      ['à¸„à¸¥à¸±à¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸‹à¹‰à¸³à¸ªà¸³à¸«à¸£à¸±à¸š reminder, session announcement, feedback à¹à¸¥à¸° reflection', 'คลังข้อความที่ใช้ซ้ำสำหรับ reminder, session announcement, feedback และ reflection'],
      ['à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸¡à¸·à¸­à¸—à¸”à¸ªà¸­à¸šà¹à¸¥à¸°à¸”à¸¹à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ à¹à¸¢à¸à¸ˆà¸²à¸à¸«à¸™à¹‰à¸²à¸—à¸³à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸¥à¸”à¸„à¸§à¸²à¸¡à¸ªà¸±à¸šà¸ªà¸™', 'เครื่องมือทดสอบและดูตัวอย่าง แยกจากหน้าทำงานจริงเพื่อลดความสับสน'],
      ['à¸à¸³à¸¥à¸±à¸‡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹€à¸§à¹‡à¸š...', 'กำลังเข้าสู่ระบบเว็บ...'],
      ['à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š LINE Login', 'กำลังตรวจสอบ LINE Login'],
      ['à¹€à¸›à¸´à¸”à¸£à¸°à¸šà¸šà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'เปิดระบบไม่สำเร็จ']
    ];

    function applyKnownTextReplacements(value) {
      let text = String(value || '');
      KNOWN_TEXT_REPLACEMENTS.forEach(([from, to]) => {
        text = text.split(from).join(to);
      });
      return text;
    }

    function hasMojibakeHint(value) {
      return /(?:Â·|Ã.|à¸|à¹|ðŸ|â€|âœ|â˜|â—|â™|ï»¿)/.test(String(value || ''));
    }

    function decodeMojibakeChunk(chunk) {
      const bytes = [];
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (code <= 0xFF) {
          bytes.push(code);
          continue;
        }
        if (CP1252_EXTRA_BYTES[ch] != null) {
          bytes.push(CP1252_EXTRA_BYTES[ch]);
          continue;
        }
        return chunk;
      }
      try {
        const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        return /[\u0E00-\u0E7F]/.test(decoded) ? decoded : chunk;
      } catch {
        return chunk;
      }
    }

    function repairMojibake(value) {
      const text = String(value || '');
      if (!hasMojibakeHint(text)) return text;
      return applyKnownTextReplacements(text.replace(/[À-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]+/g, decodeMojibakeChunk));
    }

    function repairWholeText(value) {
      const text = String(value || '');
      if (!hasMojibakeHint(text)) return text;
      return repairMojibake(text);
    }

    function normalizeRenderedText(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let currentNode = walker.nextNode();
      while (currentNode) {
        textNodes.push(currentNode);
        currentNode = walker.nextNode();
      }
      textNodes.forEach(node => {
        node.textContent = repairWholeText(node.textContent);
      });

      root.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(element => {
        if (element.placeholder) element.placeholder = repairWholeText(element.placeholder);
        if (element.value) element.value = repairWholeText(element.value);
      });

      root.querySelectorAll('option').forEach(option => {
        option.textContent = repairWholeText(option.textContent);
      });
    }

    function escapeHtml(value) {
      return applyKnownTextReplacements(repairMojibake(value)).replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[ch]);
    }

    function render(html) {
      // Any navigation invalidates the per-view live-refresh state so a stale pill/reload can't leak
      // onto a different screen. List screens re-arm it via markHrView() after their own render().
      hrViewReload = null;
      const stalePill = document.getElementById('hrRefreshPill');
      if (stalePill) stalePill.remove();
      const root = document.getElementById('app');
      const incoming = String(html || '');
      root.innerHTML = hasMojibakeHint(incoming)
        ? applyKnownTextReplacements(repairMojibake(incoming))
        : incoming;
      normalizeRenderedText(root);
    }

    // ---- HR live-refresh: silent background poll that only NUDGES (never auto-re-renders), so the
    // current view never flickers and the existing data flow is untouched until the user opts in. ----
    function hrDataSignature(d) {
      if (!d) return '';
      const emps = d.employees || [];
      const cases = d.probationCases || [];
      // include supervisor-assigned + passed counts so assigning an evaluator or approving a pass
      // (which don't change any total count) still trips the "new data" refresh pill (real-time).
      const withSup = cases.filter(c => c.supervisorUserId).length;
      const passed = cases.filter(c => c.result === 'pass' || c.status === 'passed').length;
      return [(d.users || []).length, emps.length, emps.filter(e => e.userId).length, cases.length, withSup, passed].join(':');
    }
    // A list screen calls this after rendering to say "poll for changes while I'm on screen".
    function markHrView(fn) {
      hrViewReload = fn;
      hrLastSig = hrDataSignature(adminCache);
      ensureHrPoll();
    }
    function ensureHrPoll() {
      if (hrPollTimer) return;
      hrPollTimer = setInterval(async () => {
        if (document.hidden || hrPolling || !hrViewReload) return;
        if (!currentUser || currentUser.role !== 'HR') return;
        hrPolling = true;
        try {
          const fresh = await api('/adminData');
          if (hrLastSig && hrDataSignature(fresh) !== hrLastSig) { hrPendingData = fresh; showHrRefreshPill(); }
        } catch (e) { /* silent — background refresh must never disrupt the user */ }
        finally { hrPolling = false; }
      }, 45000);
    }
    function showHrRefreshPill() {
      if (document.getElementById('hrRefreshPill')) return;
      const pill = document.createElement('button');
      pill.id = 'hrRefreshPill';
      pill.type = 'button';
      pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:82px;z-index:60;background:var(--m3-primary);color:#fff;border:0;border-radius:999px;padding:10px 18px;font-family:inherit;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.22);display:flex;align-items:center;gap:6px;cursor:pointer;animation:m3FadeUp .3s ease';
      pill.innerHTML = `${micon('sync')}มีข้อมูลใหม่ · แตะเพื่ออัปเดต`;
      pill.addEventListener('click', () => {
        const fn = hrViewReload;                       // capture before render() clears it
        if (hrPendingData) { adminCache = hrPendingData; hrPendingData = null; }
        pill.remove();
        haptic(10);
        if (fn) fn();                                  // instant re-render from the fresh cache (no skeleton)
      });
      document.body.appendChild(pill);
    }

    /* ---- Haptic (mobile only; silently ignored on desktop) ---- */
    function haptic(ms = 12) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
    // Light tap feedback whenever a score button is selected (delegated once; survives re-renders).
    document.addEventListener('change', event => {
      if (event.target && event.target.matches && event.target.matches('.m3-scorebtn input')) haptic(8);
    });

    /* ---- Toast (success/error/info) — replaces native alert() ---- */
    function toast(message, type = 'success') {
      let wrap = document.getElementById('m3-toast-wrap');
      if (!wrap) { wrap = document.createElement('div'); wrap.id = 'm3-toast-wrap'; wrap.className = 'm3-toast-wrap'; document.body.appendChild(wrap); }
      const icon = type === 'error' ? 'error' : (type === 'info' ? 'info' : 'check_circle');
      const el = document.createElement('div');
      el.className = `m3-toast m3-toast--${type}`;
      el.innerHTML = `${micon(icon)}<span>${escapeHtml(String(message == null ? '' : message))}</span>`;
      const dismiss = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 340); };
      el.addEventListener('click', dismiss);
      wrap.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      if (type === 'success') haptic(10);
      setTimeout(dismiss, 2600);
    }

    /* ---- Button busy state: disable + spinner, returns restore fn (prevents double-submit) ---- */
    function busyButton(btn, label = 'กำลังบันทึก...') {
      if (!btn) return () => {};
      const prev = btn.innerHTML;
      const wasDisabled = btn.disabled;
      btn.disabled = true;
      btn.innerHTML = `<span class="m3-spin">${micon('progress_activity')}</span>${escapeHtml(label)}`;
      return () => { btn.disabled = wasDisabled; btn.innerHTML = prev; };
    }

    /* ---- Rich empty state (icon + title + optional sub) ---- */
    function m3Empty(icon, title, sub) {
      return `<div class="m3-empty m3-empty--rich"><div class="m3-empty-ic">${micon(icon)}</div><div class="m3-empty-title">${escapeHtml(title)}</div>${sub ? `<div class="m3-empty-sub">${escapeHtml(sub)}</div>` : ''}</div>`;
    }

    /* ---- Inline required-field validation (custom, replaces the native browser bubble) ----
       Add `novalidate` to the <form> and call wireValidation(form) once; then guardRequired(form)
       at submit returns false + highlights/scrolls to the first empty required field. */
    function guardRequired(form) {
      let firstBad = null;
      form.querySelectorAll('[required]').forEach(f => {
        const bad = !String(f.value || '').trim();
        f.classList.toggle('is-invalid', bad);
        if (bad && !firstBad) firstBad = f;
      });
      if (firstBad) {
        firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
        try { firstBad.focus({ preventScroll: true }); } catch (e) { firstBad.focus(); }
        toast('กรุณากรอกข้อมูลที่จำเป็นให้ครบ', 'error');
        haptic(22);
      }
      return !firstBad;
    }
    function wireValidation(form) {
      if (!form) return;
      form.setAttribute('novalidate', '');
      form.addEventListener('input', e => { if (e.target.classList) e.target.classList.remove('is-invalid'); });
    }

    /* ---- Bottom-sheet confirm (returns Promise<boolean>) — replaces native confirm() ---- */
    function confirmSheet(opts = {}) {
      const { title = 'ยืนยัน', desc = '', confirmLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก', danger = false } = opts;
      return new Promise(resolve => {
        const scrim = document.createElement('div');
        scrim.className = 'm3-scrim';
        const sheet = document.createElement('div');
        sheet.className = 'm3-sheet';
        const iconStyle = danger
          ? 'background:var(--m3-error-container);color:var(--m3-error)'
          : 'background:var(--m3-primary-container);color:var(--m3-primary)';
        const confirmStyle = danger ? 'background:var(--m3-error);color:#fff' : 'background:var(--m3-primary);color:#fff';
        sheet.innerHTML = `
          <div class="m3-sheet-handle"></div>
          <div class="m3-sheet-icon" style="${iconStyle}">${micon(danger ? 'delete_forever' : 'help')}</div>
          <div class="m3-sheet-title">${escapeHtml(title)}</div>
          ${desc ? `<div class="m3-sheet-desc">${escapeHtml(desc).replace(/\n/g, '<br>')}</div>` : ''}
          <div class="m3-sheet-actions">
            <button type="button" data-c-cancel style="background:transparent;color:var(--m3-on-surface);border:1px solid var(--m3-outline)">${escapeHtml(cancelLabel)}</button>
            <button type="button" data-c-ok style="${confirmStyle}">${escapeHtml(confirmLabel)}</button>
          </div>`;
        document.body.appendChild(scrim);
        document.body.appendChild(sheet);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('show'); });
        let done = false;
        const onKey = e => { if (e.key === 'Escape') close(false); };
        const close = val => {
          if (done) return; done = true;
          document.removeEventListener('keydown', onKey);
          document.body.style.overflow = prevOverflow;
          scrim.classList.remove('show'); sheet.classList.remove('show');
          setTimeout(() => { scrim.remove(); sheet.remove(); }, 360);
          resolve(val);
        };
        document.addEventListener('keydown', onKey);
        scrim.addEventListener('click', () => close(false));
        sheet.querySelector('[data-c-cancel]').addEventListener('click', () => close(false));
        sheet.querySelector('[data-c-ok]').addEventListener('click', () => { haptic(danger ? 24 : 14); close(true); });
      });
    }

    function shell(title, body) {
      return `
        <main class="screen center">
          <section class="card">
            <div class="hero">
              <div class="logo">Nose<br>Tea</div>
              <div class="eyebrow">Nose Tea HR</div>
              <h1>${escapeHtml(title)}</h1>
            </div>
            <div class="body">${body}</div>
          </section>
        </main>
      `;
    }

    /* ===================================================================
       MATERIAL 3 UI LAYER (new design system)
       =================================================================== */
    function micon(name, extraClass = '') {
      return `<span class="material-symbols-outlined ${extraClass}">${name}</span>`;
    }

    function formatThaiDateTime(value) {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return formatThaiDate(value);
      return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function todayThaiLong() {
      return new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function m3TopBar(opts = {}) {
      const left = opts.back
        ? `<button type="button" class="m3-iconbtn m3-appbar-back" data-m3-back>${micon('arrow_back')}</button>`
        : `<div class="m3-brand-logo"><img class="m3-brand-img" src="/assets/logo.png?v=20260619-22" alt="Nose Tea" onerror="this.remove()"><span class="m3-brand-txt">Nose<br>Tea</span></div>`;
      return `
        <header class="m3-appbar">
          <div class="m3-appbar-brand">
            ${left}
            <h1 class="m3-appbar-title">${escapeHtml(opts.title || 'Nose Tea HR')}</h1>
          </div>
          <button type="button" class="m3-iconbtn" data-m3-action="notifications">${micon('notifications')}</button>
        </header>
      `;
    }

    function m3BottomNav(active) {
      const items = [
        ['home', 'home', 'หน้าหลัก'],
        ['onboarding', 'person_add', 'Onboarding'],
        ['probation', 'verified', 'Probation'],
        ['profile', 'account_circle', 'โปรไฟล์']
      ];
      return `
        <nav class="m3-bottomnav">
          ${items.map(([key, icon, label]) => `
            <button type="button" class="m3-nav-item ${active === key ? 'active' : ''}" data-m3-nav="${key}">
              ${micon(icon)}<span>${escapeHtml(label)}</span>
            </button>
          `).join('')}
        </nav>
      `;
    }

    function m3Shell(activeNav, body, opts = {}) {
      const fab = opts.fab
        ? `<button type="button" class="m3-fab" data-m3-action="${escapeHtml(opts.fab.action || 'fab')}" aria-label="${escapeHtml(opts.fab.label || 'Add')}">${micon(opts.fab.icon || 'add')}</button>`
        : '';
      return `
        <div class="m3-app m3-fade-up">
          ${m3TopBar(opts.bar || {})}
          <main class="m3-main">${body}</main>
          ${fab}
          ${opts.noNav ? '' : m3BottomNav(activeNav)}
        </div>
      `;
    }

    function wireM3Nav(handlers = {}) {
      document.querySelectorAll('[data-m3-nav]').forEach(button => {
        button.addEventListener('click', () => {
          const key = button.dataset.m3Nav;
          if (handlers[key]) { handlers[key](); return; }
          if (key === 'home') renderHrHome();
          else if (key === 'onboarding') renderOnboardingList();
          else if (key === 'probation') renderProbationHome();
          else if (key === 'profile') renderHrProfile();
        });
      });
      const back = document.querySelector('[data-m3-back]');
      if (back && handlers.back) back.addEventListener('click', handlers.back);
      const bell = document.querySelector('[data-m3-action="notifications"]');
      if (bell) bell.addEventListener('click', handlers.bell || (() => renderNotifications()));
    }

    async function renderNotifications() {
      const role = (currentUser && currentUser.role) || 'Mentee';
      if (role === 'HR') {
        render(m3Loading('การแจ้งเตือน'));
        try {
          const data = adminCache || await api('/adminData');
          adminCache = data;
          const upcoming = buildUpcomingSessions(data);
          const acts = buildRecentActivity(data);
          const pending = (data.summary && data.summary.pendingTasks) || 0;
          const body = `
            <section class="m3-section" style="gap:4px"><h2 class="m3-title">การแจ้งเตือน</h2><p class="m3-eyebrow">งานที่ต้องติดตาม + ความเคลื่อนไหว</p></section>
            <section class="m3-bento">
              <div class="m3-bento-card m3-pressable" data-noti-go="sessions"><div>${micon('event')}<p class="m3-bento-label">เซสชันจะถึง</p></div><p class="m3-bento-num">${upcoming.length}</p></div>
              <div class="m3-bento-card m3-pressable" data-noti-go="tasks"><div>${micon('pending_actions')}<p class="m3-bento-label">งานค้าง</p></div><p class="m3-bento-num">${pending}</p></div>
            </section>
            <section class="m3-section"><h3 class="m3-section-label">เซสชันที่จะถึง</h3>
              ${upcoming.length ? upcoming.map(s => { const dm = dateDayMonth(s.sessionDate); return `<div class="m3-session"><div class="m3-date-block"><span class="m3-date-day">${dm.day}</span><span class="m3-date-mon">${dm.mon}</span></div><div class="m3-session-body"><p class="m3-session-title">${escapeHtml(s.checkpointName || 'Session')}</p><div class="m3-session-meta"><span>${micon('schedule')}${escapeHtml(s.startTime || '-')}</span>${s.room ? `<span>${micon('location_on')}${escapeHtml(s.room)}</span>` : ''}</div></div><span class="m3-badge">M${escapeHtml(s.monthNo || 1)}</span></div>`; }).join('') : '<div class="m3-empty">ไม่มีเซสชันเร็วๆ นี้</div>'}
            </section>
            <section class="m3-section"><h3 class="m3-section-label">ความเคลื่อนไหวล่าสุด</h3>
              ${acts.length ? `<div class="m3-list">${acts.map(a => `<div class="m3-list-item"><div class="m3-list-icon ${a.iconClass}">${micon(a.icon)}</div><div class="m3-list-body"><p class="m3-list-title">${a.title}</p><p class="m3-list-sub">${a.sub}</p></div></div>`).join('')}</div>` : '<div class="m3-empty">ยังไม่มีความเคลื่อนไหว</div>'}
            </section>`;
          render(m3Shell('home', body, { bar: { title: 'การแจ้งเตือน', back: true } }));
          wireM3Nav({ back: () => renderHrHome() });
          document.querySelectorAll('[data-noti-go]').forEach(el => el.addEventListener('click', () => {
            if (el.dataset.notiGo === 'sessions') renderSessionsM3(); else renderProbationHome();
          }));
        } catch (e) { render(m3ErrorScreen(e.message)); }
        return;
      }
      // mentee / mentor
      const tasks = currentTasks || [];
      const meta = currentPortalMeta || {};
      const pending = tasks.filter(t => t.status !== 'Completed');
      const nextSession = tasks.filter(t => t.sessionDate).sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)))[0];
      const body = `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">การแจ้งเตือน</h2><p class="m3-eyebrow">งานที่ต้องทำของคุณ</p></section>
        ${nextSession ? `<section class="m3-section"><h3 class="m3-section-label">เซสชันที่จะถึง</h3><div class="m3-session"><div class="m3-date-block"><span class="m3-date-day">${dateDayMonth(nextSession.sessionDate).day}</span><span class="m3-date-mon">${dateDayMonth(nextSession.sessionDate).mon}</span></div><div class="m3-session-body"><p class="m3-session-title">${escapeHtml(nextSession.title || 'เซสชัน')}</p><div class="m3-session-meta"><span>${micon('schedule')}${escapeHtml(nextSession.startTime || '-')}</span></div></div></div></section>` : ''}
        <section class="m3-section"><h3 class="m3-section-label">งานที่ต้องทำ (${pending.length})</h3>
          ${pending.length ? pending.map(m3TaskCard).join('') : '<div class="m3-empty">ไม่มีงานค้าง 🎉</div>'}
        </section>`;
      render(m3Shell('home', body, { bar: { title: 'การแจ้งเตือน', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderUserPortal(currentUser, tasks, { meta }) });
      document.querySelectorAll('[data-ptask]').forEach(b => b.addEventListener('click', () => {
        const task = tasks.find(t => t.taskId === b.dataset.ptask);
        if (task) renderM3TaskForm(currentUser, task, { meta });
      }));
    }

    const M3_LOADING_MSGS = ['แป๊บนึงนะ กำลังโหลด...', 'กำลังชงชาให้อยู่ ☕', 'จัดข้อมูลให้เรียบร้อย...', 'อีกนิดเดียว 🍵'];
    function m3Loading(title = 'Nose Tea HR') {
      const msg = M3_LOADING_MSGS[Math.floor(Math.random() * M3_LOADING_MSGS.length)];
      return `
        <div class="m3-app">
          ${m3TopBar({ title })}
          <main class="m3-main">
            <div class="m3-loading">
              <div class="m3-load-logo"><img class="m3-brand-img" src="/assets/logo.png?v=20260619-22" alt="Nose Tea" onerror="this.remove()"><span class="m3-brand-txt">Nose<br>Tea</span></div>
              <div class="m3-spinner"></div>
              <p class="m3-load-text">${escapeHtml(msg)}</p>
            </div>
          </main>
        </div>
      `;
    }

    function skelBox(w, h, extra = '') {
      return `<div class="m3-skeleton" style="width:${w};height:${h};${extra}"></div>`;
    }

    function m3SkeletonList(count = 4) {
      const card = `
        <div class="m3-staff" style="pointer-events:none">
          <div class="m3-staff-head">
            <div class="m3-staff-id">
              ${skelBox('44px', '44px', 'border-radius:50%;flex-shrink:0')}
              <div style="flex:1">
                ${skelBox('60%', '14px', 'margin-bottom:8px')}
                ${skelBox('40%', '11px')}
              </div>
            </div>
            ${skelBox('56px', '22px', 'border-radius:11px')}
          </div>
          ${skelBox('100%', '10px', 'margin-top:14px')}
          ${skelBox('70%', '8px', 'margin-top:10px')}
        </div>`;
      return Array.from({ length: count }, () => card).join('');
    }

    function m3SkeletonScreen(activeNav, title, count = 4) {
      const body = `
        <section class="m3-section">
          ${skelBox('45%', '24px', 'margin-bottom:8px')}
          ${skelBox('100%', '44px', 'border-radius:var(--m3-radius-md)')}
        </section>
        <section class="m3-section">${m3SkeletonList(count)}</section>`;
      return m3Shell(activeNav, body, { bar: { title } });
    }

    function m3SkeletonHome() {
      const body = `
        <section class="m3-section">
          ${skelBox('55%', '26px', 'margin-bottom:8px')}
          ${skelBox('35%', '13px')}
        </section>
        <section class="m3-section">
          <div class="m3-stat3">
            ${[0, 1, 2].map(() => `<div>${skelBox('60%', '11px', 'margin:0 auto 8px')}${skelBox('40%', '22px', 'margin:0 auto')}</div>`).join('')}
          </div>
        </section>
        <section class="m3-section">${m3SkeletonList(3)}</section>`;
      return m3Shell('home', body, { bar: {} });
    }

    function m3ErrorScreen(message) {
      return `
        <div class="m3-app">
          ${m3TopBar({})}
          <main class="m3-main"><div class="m3-empty" style="border-color:var(--m3-error);color:var(--m3-error)">${escapeHtml(message)}</div></main>
        </div>
      `;
    }

    function buildRecentActivity(data) {
      const acts = [];
      (data.bindLogs || []).slice(0, 4).forEach(log => {
        const emp = (data.employees || []).find(item => item.employeeId === log.employeeId);
        const user = (data.users || []).find(item => item.userId === log.userId);
        const name = (emp && emp.employeeName) || (user && user.name) || log.userId || 'พนักงาน';
        const unlink = log.action === 'unlink';
        acts.push({
          icon: unlink ? 'link_off' : 'person_add',
          iconClass: unlink ? 'm3-list-icon--error' : '',
          title: `<strong>${escapeHtml(name)}</strong> ${unlink ? 'ยกเลิกการผูก LINE' : 'ผูกบัญชี LINE แล้ว'}`,
          sub: `${formatThaiDateTime(log.createdAt)}${emp && emp.department ? ' · ' + escapeHtml(emp.department) : ''}`
        });
      });
      if (acts.length < 4) {
        (data.recentQueue || []).slice(0, 4 - acts.length).forEach(task => {
          const owner = (data.users || []).find(item => item.userId === task.ownerUserId);
          acts.push({
            icon: 'pending_actions',
            iconClass: 'm3-list-icon--tertiary',
            title: `งาน <strong>${escapeHtml(task.title || task.taskType)}</strong> รอดำเนินการ`,
            sub: `${owner ? escapeHtml(owner.name || owner.userId) : 'ไม่ระบุ'} · ครบกำหนด ${formatThaiDate(task.dueDate)}`
          });
        });
      }
      return acts;
    }

    const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    function dateDayMonth(value) {
      const date = value ? new Date(`${value}T00:00:00`) : null;
      if (!date || Number.isNaN(date.getTime())) return { day: '--', mon: '' };
      return { day: String(date.getDate()), mon: THAI_MONTHS_SHORT[date.getMonth()] };
    }

    function buildUpcomingSessions(data) {
      const today = new Date().toISOString().slice(0, 10);
      return (data.sessions || [])
        .filter(session => session.sessionDate && session.sessionDate >= today && session.status !== 'Closed')
        .sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)))
        .slice(0, 3);
    }

    function hrHomeMarkup(data) {
      const summary = data.summary || {};
      const probationCount = (data.employees || []).filter(item => item.probationRequired).length;
      const activeGroups = summary.activeGroups || 0;
      const acts = buildRecentActivity(data);
      const upcoming = buildUpcomingSessions(data);
      const adminName = (data.currentUser && (data.currentUser.name || data.currentUser.displayName)) || 'Admin';

      const body = `
        <section class="m3-section" style="gap:4px">
          <p class="m3-eyebrow">${escapeHtml(todayThaiLong())}</p>
          <h2 class="m3-title">ยินดีต้อนรับ, ${escapeHtml(adminName)}</h2>
        </section>

        ${actionCenterCard(hrActionItems(data))}

        <section class="m3-bento">
          <div class="m3-bento-card m3-pressable" data-m3-go="onboarding">
            <div>${micon('person_add')}<p class="m3-bento-label">Onboarding</p></div>
            <p class="m3-bento-num">${activeGroups} <small>กลุ่ม Active</small></p>
          </div>
          <div class="m3-bento-card m3-pressable" data-m3-go="probation">
            <div>${micon('verified')}<p class="m3-bento-label">Probation</p></div>
            <p class="m3-bento-num">${probationCount} <small>คนติดตาม</small></p>
          </div>
        </section>

        <section class="m3-section"><div class="m3-card m3-card-pad" style="background:linear-gradient(135deg,#eef6f1,#dfeee6);border-color:var(--m3-primary)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><div class="m3-list-icon" style="background:var(--m3-primary);color:#fff">${micon('leaderboard')}</div><div><div class="m3-staff-name">ระบบ KPI</div><div class="m3-staff-role">ตั้ง · มอบหมาย · ตั้งหัวหน้าฝ่าย · ภาพรวมคะแนน</div></div></div>
          <button type="button" class="m3-btn m3-btn--tonal" data-kpi-admin style="width:100%">${micon('open_in_new')}เปิดระบบ KPI</button>
        </div></section>

        <section class="m3-section">
          <h3 class="m3-section-label">ทางลัด</h3>
          <div class="m3-chip-row">
            <button type="button" class="m3-chip m3-chip--filled" data-m3-go="add-staff">${micon('add')}เพิ่มพนักงาน</button>
            <button type="button" class="m3-chip" data-m3-go="assign-mentor">${micon('supervisor_account')}มอบหมาย Mentor</button>
            <button type="button" class="m3-chip" data-m3-go="probation">${micon('rate_review')}ตรวจ Probation</button>
          </div>
        </section>

        <section class="m3-section" style="gap:16px">
          <div class="m3-module m3-module--primary" data-m3-go="onboarding">
            <div class="m3-module-z">
              <h4>Onboarding</h4>
              <p>จัดการกลุ่มและเส้นทางพนักงานใหม่</p>
            </div>
            ${micon('group_add', 'm3-module-ghost')}
            ${micon('chevron_right', 'm3-module-z')}
          </div>
          <div class="m3-module m3-module--surface" data-m3-go="probation">
            <div class="m3-module-z">
              <h4>Probation</h4>
              <p>ติดตามการประเมินทดลองงาน 30/60/90 วัน</p>
            </div>
            ${micon('verified_user', 'm3-module-ghost')}
            ${micon('chevron_right', 'm3-module-z')}
          </div>
        </section>

        <section class="m3-section">
          <div class="m3-section-head">
            <h3 class="m3-section-label">เซสชันที่จะถึง</h3>
            <a class="m3-link" data-m3-go="sessions">จัดการ</a>
          </div>
          ${upcoming.length ? upcoming.map(session => {
            const dm = dateDayMonth(session.sessionDate);
            return `
              <div class="m3-session m3-pressable" data-m3-session="${escapeHtml(session.checkpointId)}">
                <div class="m3-date-block"><span class="m3-date-day">${dm.day}</span><span class="m3-date-mon">${dm.mon}</span></div>
                <div class="m3-session-body">
                  <p class="m3-session-title">${escapeHtml(session.checkpointName || 'Session')}</p>
                  <div class="m3-session-meta">
                    <span>${micon('schedule')}${escapeHtml(session.startTime || '-')}${session.endTime ? '-' + escapeHtml(session.endTime) : ''}</span>
                    ${session.room ? `<span>${micon('location_on')}${escapeHtml(session.room)}</span>` : ''}
                    <span>${micon('groups')}${escapeHtml(renderSessionGroupName(session, data))}</span>
                  </div>
                </div>
                <span class="m3-badge">M${escapeHtml(session.monthNo || 1)}</span>
              </div>
            `;
          }).join('') : '<div class="m3-empty">ยังไม่มีเซสชันที่จะถึง</div>'}
        </section>

        <section class="m3-section">
          <div class="m3-section-head">
            <h3 class="m3-section-label">ความเคลื่อนไหวล่าสุด</h3>
            <a class="m3-link" data-m3-go="onboarding">ดูทั้งหมด</a>
          </div>
          ${acts.length ? `<div class="m3-list">
            ${acts.map(act => `
              <div class="m3-list-item">
                <div class="m3-list-icon ${act.iconClass}">${micon(act.icon)}</div>
                <div class="m3-list-body">
                  <p class="m3-list-title">${act.title}</p>
                  <p class="m3-list-sub">${act.sub}</p>
                </div>
              </div>
            `).join('')}
          </div>` : '<div class="m3-empty">ยังไม่มีความเคลื่อนไหว</div>'}
        </section>
      `;

      return m3Shell('home', body, {
        bar: { title: 'Nose Tea HR' },
        fab: { icon: 'add', action: 'add-staff', label: 'เพิ่มพนักงาน' }
      });
    }

    async function renderHrHome() {
      render(m3SkeletonHome());
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        render(hrHomeMarkup(data));
        wireM3Nav();
        markHrView(renderHrHome);
        const go = target => {
          if (target === 'onboarding') renderOnboardingList();
          else if (target === 'assign-mentor') renderGroupsM3();
          else if (target === 'add-staff') renderEmployeesM3();
          else if (target === 'sessions') renderSessionsM3();
          else if (target === 'probation') renderProbationHome();
        };
        document.querySelectorAll('[data-m3-go]').forEach(el => {
          el.addEventListener('click', () => go(el.dataset.m3Go));
        });
        document.querySelectorAll('[data-m3-session]').forEach(el => {
          el.addEventListener('click', () => renderSessionsM3());
        });
        document.querySelectorAll('[data-ac-prob]').forEach(el => {
          el.addEventListener('click', () => renderProbationDetail(el.dataset.acProb, data));
        });
        const fab = document.querySelector('[data-m3-action="add-staff"]');
        if (fab) fab.addEventListener('click', () => go('add-staff'));
        const kpiBtn = document.querySelector('[data-kpi-admin]');
        if (kpiBtn) kpiBtn.addEventListener('click', () => { window.KPI && window.KPI.renderHome ? window.KPI.renderHome() : toast('โมดูล KPI ยังไม่พร้อม', 'error'); });
      } catch (error) {
        render(m3ErrorScreen(error.message));
      }
    }

    /* ---- Probation List + Detail (Step 3) ---- */
    function daysSince(dateString) {
      if (!dateString) return null;
      const start = new Date(`${dateString}T00:00:00`);
      if (Number.isNaN(start.getTime())) return null;
      return Math.floor((Date.now() - start.getTime()) / 86400000);
    }

    function probationMilestones(emp, data) {
      const tasks = (data.tasks || []).filter(task => task.taskType === 'Probation' && task.employeeId === emp.employeeId);
      const byMonth = new Map(tasks.map(task => [Number(task.monthNo || 0), task]));
      // base 30/60/90 + any extension rounds (monthNo > 3 created by "ขยายเวลา"); each round = m*30 วัน
      const months = [...new Set([1, 2, 3, ...[...byMonth.keys()].filter(m => m > 0)])].sort((a, b) => a - b);
      let currentAssigned = false;
      return months.map(m => {
        const task = byMonth.get(m) || null;
        let state;
        if (!task) state = 'locked';
        else if (task.status === 'Completed') state = 'done';
        else if (!currentAssigned) { state = 'current'; currentAssigned = true; }
        else state = 'upcoming';
        return { day: m * 30, monthNo: m, state, task };
      });
    }

    function probationStatusOf(kase) {
      if (!kase) return { key: 'pending', label: 'รอมอบหมาย', badge: 'm3-badge--warn' };
      // "Passed" wins first — covers HR override (passed with no supervisor) as well as normal pass.
      if (kase.result === 'pass') return { key: 'pass', label: 'ผ่าน', badge: 'm3-badge--ok' };
      if (!kase.supervisorUserId) return { key: 'pending', label: 'รอมอบหมาย', badge: 'm3-badge--warn' };
      if (kase.result === 'extend') return { key: 'extended', label: 'ขยายเวลา', badge: 'm3-badge--error' };
      return { key: 'reviewing', label: 'กำลังประเมิน', badge: 'm3-badge' };
    }

    function buildProbationRows(data) {
      const cases = new Map((data.probationCases || []).map(c => [c.employeeId, c]));
      return (data.employees || [])
        .filter(emp => emp.probationRequired || cases.has(emp.employeeId))
        .map(emp => {
          const kase = cases.get(emp.employeeId) || null;
          return { emp, kase, status: probationStatusOf(kase), milestones: probationMilestones(emp, data) };
        });
    }

    function milestoneBox(ms) {
      const icon = ms.state === 'done' ? 'check_circle' : (ms.state === 'current' ? 'schedule' : 'lock_clock');
      return `
        <div class="m3-ms">
          <div class="m3-ms-box ${ms.state === 'done' ? 'done' : (ms.state === 'current' ? 'current' : '')}">${micon(icon, ms.state === 'done' ? 'm3-fill' : '')}</div>
          <span class="m3-ms-label">${ms.day}D</span>
        </div>
      `;
    }

    function probationCard(row) {
      const search = `${row.emp.employeeName} ${row.emp.position || ''} ${row.emp.branch || ''} ${row.emp.department || ''} ${row.emp.employeeCode || ''}`.toLowerCase();
      return `
        <div class="m3-staff m3-pressable" data-prob-card="${escapeHtml(row.emp.employeeId)}" data-status="${row.status.key}" data-dept="${escapeHtml(row.emp.department || '')}" data-search="${escapeHtml(search)}">
          <div class="m3-staff-head">
            <div class="m3-staff-id">
              <div class="m3-avatar">${escapeHtml(initials(row.emp.employeeName))}</div>
              <div>
                <div class="m3-staff-name">${escapeHtml(row.emp.employeeName)}</div>
                <div class="m3-staff-role">${escapeHtml(row.emp.employeeCode || '-')} · ${escapeHtml(row.emp.position || '-')}</div>
              </div>
            </div>
            <span class="m3-badge ${row.status.badge}">${escapeHtml(row.status.label)}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:13px;color:var(--m3-on-surface-variant)">
            <div><div style="font-size:11px;text-transform:uppercase;color:var(--m3-outline)">สาขา</div><div style="color:var(--m3-on-surface)">${escapeHtml(row.emp.branch || '-')}</div></div>
            <div><div style="font-size:11px;text-transform:uppercase;color:var(--m3-outline)">เริ่มงาน</div><div style="color:var(--m3-on-surface)">${formatThaiDate(row.emp.startDate)}</div></div>
          </div>
          <div class="m3-ms-head">ความคืบหน้าการประเมิน</div>
          <div class="m3-milestones">${row.milestones.map(milestoneBox).join('')}</div>
        </div>
      `;
    }

    async function renderProbationHome() {
      render(m3SkeletonScreen('probation', 'Probation'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const rows = buildProbationRows(data);
        const body = `
          <section class="m3-section">
            <div class="m3-section-head" style="align-items:center">
              <div><h2 class="m3-title">Probation</h2><p class="m3-eyebrow">ติดตามการประเมินทดลองงาน 30/60/90 วัน</p></div>
              <div style="display:flex;gap:8px">
                <button type="button" class="m3-chip" data-prob-results>${micon('insights')}สรุปผล</button>
                <button type="button" class="m3-chip" data-prob-templates>${micon('description')}แบบฟอร์ม</button>
              </div>
            </div>
          </section>
          <div class="m3-stickytop">
            <div class="m3-search">${micon('search')}<input id="probSearch" placeholder="ค้นหาชื่อ รหัส หรือสาขา"></div>
            <div class="m3-filterbar">
              <button type="button" class="m3-filter active" data-prob-filter="all">ทั้งหมด</button>
              <button type="button" class="m3-filter" data-prob-filter="reviewing">กำลังประเมิน</button>
              <button type="button" class="m3-filter" data-prob-filter="pending">รอมอบหมาย</button>
              <button type="button" class="m3-filter" data-prob-filter="pass">ผ่าน</button>
              <button type="button" class="m3-filter" data-prob-filter="extended">ขยายเวลา</button>
            </div>
            <select class="m3-select" id="probDeptFilter">${deptOptions(rows.map(r => r.emp.department))}</select>
          </div>
          <section class="m3-section m3-stagger" id="probList">
            ${rows.length ? rows.map(probationCard).join('') : m3Empty('verified', 'ยังไม่มีพนักงานทดลองงาน', 'ตั้ง “ต้องประเมิน” ใน Master Data หรือ import CSV แล้วจะขึ้นที่นี่')}
          </section>
        `;
        render(m3Shell('probation', body, { bar: { title: 'Probation' } }));
        wireM3Nav();
        const templatesBtn = document.querySelector('[data-prob-templates]');
        if (templatesBtn) templatesBtn.addEventListener('click', () => renderTemplateList(data));
        const probResBtn = document.querySelector('[data-prob-results]');
        if (probResBtn) probResBtn.addEventListener('click', () => renderProbationResults(data));
        const search = document.getElementById('probSearch');
        const deptFilter = document.getElementById('probDeptFilter');
        let activeFilter = 'all';
        const apply = () => {
          const keyword = (search.value || '').trim().toLowerCase();
          const dept = deptFilter.value;
          document.querySelectorAll('[data-prob-card]').forEach(card => {
            const matchKw = !keyword || card.dataset.search.includes(keyword);
            const matchFilter = activeFilter === 'all' || card.dataset.status === activeFilter;
            const matchDept = !dept || card.dataset.dept === dept;
            card.style.display = matchKw && matchFilter && matchDept ? '' : 'none';
          });
        };
        search.addEventListener('input', apply);
        deptFilter.addEventListener('change', apply);
        document.querySelectorAll('[data-prob-filter]').forEach(button => {
          button.addEventListener('click', () => {
            document.querySelectorAll('[data-prob-filter]').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            activeFilter = button.dataset.probFilter;
            apply();
          });
        });
        document.querySelectorAll('[data-prob-card]').forEach(card => {
          card.addEventListener('click', () => renderProbationDetail(card.dataset.probCard, data));
        });
      } catch (error) {
        render(m3ErrorScreen(error.message));
      }
    }

    function probationTlItem(ms, row) {
      const labels = { done: ['เสร็จสิ้น', 'm3-badge--ok'], current: ['กำลังประเมิน', 'm3-badge--warn'], upcoming: ['รอรอบ', 'm3-badge'], locked: ['ยังไม่เริ่ม', 'm3-badge'] };
      const [label, badge] = labels[ms.state] || labels.locked;
      // Prefer the task's real due date (correct for every round incl. +30 extensions: offset = day-1
      // → 29/59/89/119...); fall back to the case's precomputed 30/60/90 dates only when no task yet.
      const dueKey = ms.day === 30 ? 'day30Due' : (ms.day === 60 ? 'day60Due' : 'day90Due');
      const due = (ms.task && ms.task.dueDate) || (row.kase ? row.kase[dueKey] : null);
      return `
        <div class="m3-tl-item">
          <div class="m3-tl-dot ${ms.state === 'done' ? 'done' : (ms.state === 'current' ? 'active' : '')}">${ms.state === 'done' ? micon('check') : ''}</div>
          <div class="m3-tl-card ${ms.state === 'current' ? 'active' : (ms.state === 'done' ? '' : 'pending')}">
            <div>
              <div class="m3-tl-title">ประเมิน ${ms.day} วัน</div>
              <div class="m3-tl-sub">ครบกำหนด ${formatThaiDate(due)}${(row.kase && row.kase.supervisorName) ? ' · ' + escapeHtml(row.kase.supervisorName) : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              ${ms.state === 'done' && ms.task ? `<button type="button" class="m3-iconbtn" data-prob-print="${escapeHtml(ms.task.taskId)}" title="พิมพ์ผลประเมิน">${micon('print')}</button>` : ''}
              <span class="m3-badge ${badge}">${label}</span>
            </div>
          </div>
        </div>
      `;
    }

    // HR-only: employee self-scores vs the boss's scores per competency item (gap). Display-only —
    // a calibration/discussion aid, never part of the pass/fail computation.
    async function renderProbationGap(employeeId, employeeName) {
      render(m3Loading('ผลประเมินตนเอง'));
      let res;
      try { res = await api('/getProbationGap', { employeeId }); }
      catch (e) { toast(e.message, 'error'); renderProbationDetail(employeeId, adminCache || {}); return; }

      const delta = d => d == null ? '<span style="color:var(--m3-muted)">–</span>'
        : (d === 0 ? '<span style="color:var(--m3-primary)">0</span>'
          : `<span style="color:${d > 0 ? '#ef7b2f' : 'var(--m3-muted)'};font-weight:700">${d > 0 ? '+' : ''}${d}</span>`);

      const rounds = (res.rounds || []).map(rd => `
        <section class="m3-section">
          <h3 class="m3-section-label">รอบ ${rd.day} วัน</h3>
          <div class="m3-card m3-card-pad">
            <div style="display:flex;font-size:11px;color:var(--m3-muted);text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid var(--m3-outline-variant)">
              <span style="flex:1">หัวข้อ</span><span style="width:52px;text-align:center">ตนเอง</span><span style="width:52px;text-align:center">หัวหน้า</span><span style="width:48px;text-align:center">ต่าง</span>
            </div>
            ${rd.items.map(it => `
              <div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid var(--m3-outline-variant)">
                <span style="flex:1;font-size:13px">${escapeHtml(it.label)}</span>
                <span style="width:52px;text-align:center;font-weight:700">${it.self != null ? it.self : '–'}</span>
                <span style="width:52px;text-align:center;font-weight:700">${it.boss != null ? it.boss : '–'}</span>
                <span style="width:48px;text-align:center">${delta(it.delta)}</span>
              </div>`).join('')}
          </div>
        </section>`).join('');

      const body = `
        <section class="m3-section" style="gap:4px">
          <h2 class="m3-title">ผลประเมินตนเอง</h2>
          <p class="m3-eyebrow">${escapeHtml(employeeName || '')} · เทียบคะแนนที่พนักงานให้ตนเอง กับคะแนนของหัวหน้างาน (หัวข้อ KPI และ Competency)</p>
        </section>
        <div class="m3-card m3-card-pad" style="background:var(--m3-warn-bg);border-color:var(--m3-warn-fg)"><p class="cap" style="color:var(--m3-warn-fg);margin:0">ข้อมูลนี้ใช้เพื่อพูดคุยและปรับความเข้าใจเท่านั้น · ไม่มีผลต่อคะแนนผ่าน–ไม่ผ่าน · <strong>ต่าง = ตนเอง − หัวหน้างาน</strong> (บวก = พนักงานให้ตัวเองสูงกว่า)</p></div>
        ${rounds || m3Empty('compare_arrows', 'ยังไม่มีผลประเมินตนเอง', 'พนักงานยังไม่ได้ประเมินตนเองในรอบที่หัวหน้าปิดแล้ว')}
        <div style="height:30px"></div>`;
      render(m3Shell('probation', body, { bar: { title: 'ผลประเมินตนเอง', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderProbationDetail(employeeId, adminCache || {}) });
    }

    function renderProbationDetail(employeeId, data, opts = {}) {
      const rows = buildProbationRows(data);
      const row = rows.find(item => item.emp.employeeId === employeeId);
      if (!row) { renderProbationHome(); return; }
      const tenure = daysSince(row.emp.startDate);
      // Re-bind allowed only while no round has been evaluated yet (audit-safe).
      const evaluated = row.milestones.some(ms => ms.state === 'done');
      // Any active employee can be assigned as evaluator (rights granted by HR per case,
      // decoupled from role) — exclude the probationer themselves.
      const evaluators = (data.users || [])
        .filter(user => user.active && user.userId !== row.emp.userId)
        .sort((a, b) => (a.role === 'Mentor' ? -1 : 0) - (b.role === 'Mentor' ? -1 : 0) || String(a.name || '').localeCompare(String(b.name || '')));
      const hasSupervisor = Boolean(row.kase && row.kase.supervisorUserId);
      const isPassed = row.status.key === 'pass';
      // A passed case shows a read-only "passed" state; "แก้ไขสถานะ" (opts.editPassed) reopens the
      // controls so a mistaken pass/override is never a dead-end.
      const uiPassed = isPassed && !opts.editPassed;

      const showPicker = !uiPassed && (!hasSupervisor || opts.reassign);
      const curTpl = (row.kase && row.kase.templateId) || '';
      const curSup = (row.kase && row.kase.supervisorUserId) || '';
      const supervisorBlock = !showPicker
        ? `<div class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:12px">
             <div class="m3-list-icon">${micon('supervisor_account')}</div>
             <div style="flex:1;min-width:0"><div class="m3-staff-name">${escapeHtml(row.kase.supervisorName || '-')}</div><div class="m3-staff-role">หัวหน้างานผู้ประเมิน</div></div>
             ${!evaluated ? `<button type="button" class="m3-iconbtn" data-prob-reassign title="เปลี่ยนผู้ประเมิน / ฟอร์ม">${micon('edit')}</button>` : ''}
           </div>`
        : `<div class="m3-assign-card">
             <div class="cap">${micon('person_alert')} ${hasSupervisor ? 'เปลี่ยนผู้ประเมิน / ฟอร์ม (ยังไม่เริ่มประเมิน)' : 'ยังไม่ได้มอบหมายหัวหน้าประเมิน'}</div>
             <select class="m3-select" id="probTemplate">
               ${(data.probationTemplates || []).filter(t => t.active !== false).map(t => `<option value="${escapeHtml(t.templateId)}" ${t.templateId === curTpl ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('') || '<option value="PT-C">Form C</option>'}
             </select>
             <select class="m3-select" id="probSupervisor">
               <option value="">เลือกผู้ประเมิน (พนักงานที่ใช้งานอยู่)</option>
               ${evaluators.map(user => `<option value="${escapeHtml(user.userId)}" ${user.userId === curSup ? 'selected' : ''}>${escapeHtml(user.name || user.displayName)} · ${escapeHtml(user.role || 'Staff')}${user.department ? ' · ' + escapeHtml(user.department) : ''}</option>`).join('')}
             </select>
             <button type="button" class="m3-btn" data-prob-assign="${escapeHtml(row.emp.employeeId)}">${micon('check')}${hasSupervisor ? 'บันทึกการเปลี่ยน' : 'มอบหมาย & สร้างงานประเมิน'}</button>
             ${hasSupervisor ? `<button type="button" class="m3-btn m3-btn--ghost" data-prob-reassign-cancel>ยกเลิก</button>` : ''}
           </div>`;
      const currentMilestone = row.milestones.find(ms => ms.state === 'current' && ms.task);
      const caseTpl = (data.probationTemplates || []).find(t => t.templateId === ((row.kase && row.kase.templateId) || ''));
      const selfEnabled = Boolean(caseTpl && caseTpl.selfReviewEnabled);

      const body = `
        <section class="m3-card m3-card-pad">
          <div style="display:flex;align-items:center;gap:16px">
            <div class="m3-avatar m3-avatar--lg">${escapeHtml(initials(row.emp.employeeName))}</div>
            <div style="min-width:0">
              <h2 class="m3-headline">${escapeHtml(row.emp.employeeName)}</h2>
              <p class="m3-staff-role">รหัส ${escapeHtml(row.emp.employeeCode || '-')} · ${escapeHtml(row.emp.position || '-')}</p>
              <span class="m3-badge ${row.status.badge}" style="margin-top:6px">${escapeHtml(row.status.label)}</span>
            </div>
          </div>
          <div class="m3-stat3" style="grid-template-columns:1fr 1fr">
            <div><div class="cap">เริ่มงาน</div><div class="val">${formatThaiDate(row.emp.startDate)}</div></div>
            <div><div class="cap">อายุงาน</div><div class="val">${tenure != null ? tenure + ' วัน' : '-'}</div></div>
          </div>
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">${uiPassed ? 'สถานะทดลองงาน' : 'หัวหน้างานผู้ประเมิน'}</h3>
          ${uiPassed
            ? `<div class="m3-card m3-card-pad" style="border-color:var(--m3-primary)"><div style="display:flex;align-items:center;gap:12px"><div class="m3-list-icon">${micon('verified')}</div><div style="min-width:0;flex:1"><div class="m3-staff-name">ผ่านทดลองงานแล้ว</div><div class="m3-staff-role">${escapeHtml((row.kase && (row.kase.notes || (row.kase.supervisorName ? 'ประเมินโดย ' + row.kase.supervisorName : ''))) || '')}</div></div></div><button type="button" class="m3-btn m3-btn--ghost" data-prob-editpassed style="margin-top:10px;min-height:40px">${micon('edit')}แก้ไขสถานะ</button></div>`
            : supervisorBlock}
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">เส้นทางการประเมิน</h3>
          <div class="m3-timeline">${row.milestones.map(ms => probationTlItem(ms, row)).join('')}</div>
        </section>

        ${hasSupervisor && !uiPassed ? `
        <section class="m3-section" style="gap:10px">
          ${currentMilestone ? `<button type="button" class="m3-btn" data-prob-eval="${escapeHtml(currentMilestone.task.taskId)}">${micon('assignment')}ทำแบบประเมินรอบ ${currentMilestone.day} วัน</button>` : ''}
          <div style="display:flex;gap:10px">
            <button type="button" class="m3-btn" style="background:var(--m3-primary)" data-prob-result="pass" data-case="${escapeHtml(row.kase.caseId)}">${micon('verified')}อนุมัติผ่าน</button>
            <button type="button" class="m3-btn m3-btn--outline" data-prob-result="extend" data-case="${escapeHtml(row.kase.caseId)}">ขยายเวลา</button>
          </div>
          <button type="button" class="m3-btn m3-btn--ghost" data-prob-remind="${escapeHtml(row.kase.supervisorUserId)}">${micon('notifications')}ส่งเตือนหัวหน้าผ่าน LINE</button>
        </section>` : ''}

        ${!hasSupervisor && !uiPassed ? `
        <section class="m3-section">
          <div class="m3-card m3-card-pad">
            <div class="m3-section-label" style="margin-bottom:6px">บันทึกผลนอกระบบ</div>
            <p class="m3-save-hint" style="text-align:left;margin:0 0 10px">สำหรับพนักงานที่ผ่านทดลองงานแล้วก่อนใช้แอป หรือประเมินบนกระดาษ — บันทึกว่า “ผ่าน” ได้เลย ไม่ต้องมอบหมายผู้ประเมิน/ทำแบบประเมินในระบบ</p>
            <button type="button" class="m3-btn m3-btn--outline" data-prob-override="${escapeHtml(row.emp.employeeId)}">${micon('task_alt')}บันทึกว่าผ่านทดลองงานแล้ว</button>
          </div>
        </section>` : ''}

        ${selfEnabled ? `
        <section class="m3-section">
          <button type="button" class="m3-btn m3-btn--ghost" data-prob-gap="${escapeHtml(row.emp.employeeId)}">${micon('compare_arrows')}ผลประเมินตนเอง (เทียบหัวหน้า)</button>
        </section>` : ''}
      `;
      render(m3Shell('probation', body, { bar: { title: 'ประเมินทดลองงาน', back: true } }));
      wireM3Nav({ back: () => renderProbationHome() });

      const assign = document.querySelector('[data-prob-assign]');
      if (assign) assign.addEventListener('click', async () => {
        const supervisorUserId = document.getElementById('probSupervisor').value;
        const templateId = document.getElementById('probTemplate') ? document.getElementById('probTemplate').value : '';
        if (!supervisorUserId) { toast('กรุณาเลือกผู้ประเมิน', 'error'); return; }
        const restore = busyButton(assign, 'กำลังบันทึก...');
        try {
          await api('/assignProbationSupervisor', { employeeId: assign.dataset.probAssign, supervisorUserId, templateId });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          toast(opts.reassign ? 'เปลี่ยนการมอบหมายแล้ว' : 'มอบหมายแล้ว');
          renderProbationDetail(employeeId, fresh);
        } catch (error) { restore(); toast(error.message, 'error'); }
      });
      const gapBtn = document.querySelector('[data-prob-gap]');
      if (gapBtn) gapBtn.addEventListener('click', () => renderProbationGap(row.emp.employeeId, row.emp.employeeName));
      const editPassedBtn = document.querySelector('[data-prob-editpassed]');
      if (editPassedBtn) editPassedBtn.addEventListener('click', () => renderProbationDetail(employeeId, data, { editPassed: true }));
      const overrideBtn = document.querySelector('[data-prob-override]');
      if (overrideBtn) overrideBtn.addEventListener('click', async () => {
        if (!await confirmSheet({ title: 'บันทึกว่าผ่านทดลองงานแล้ว?', desc: 'ใช้สำหรับพนักงานที่ผ่านทดลองงานแล้วก่อนใช้แอป หรือประเมินนอกระบบ · จะบันทึกสถานะเป็น “ผ่าน” โดยไม่มีคะแนนในระบบ (ยังแก้/มอบหมายใหม่ได้ภายหลัง)', confirmLabel: 'บันทึกว่าผ่าน' })) return;
        const restore = busyButton(overrideBtn, 'กำลังบันทึก...');
        try {
          await api('/overrideProbationPass', { employeeId: overrideBtn.dataset.probOverride });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          toast('บันทึกว่าผ่านทดลองงานแล้ว');
          renderProbationDetail(employeeId, fresh);
        } catch (error) { restore(); toast(error.message, 'error'); }
      });
      const reassignBtn = document.querySelector('[data-prob-reassign]');
      if (reassignBtn) reassignBtn.addEventListener('click', () => renderProbationDetail(employeeId, data, { reassign: true }));
      const reassignCancel = document.querySelector('[data-prob-reassign-cancel]');
      if (reassignCancel) reassignCancel.addEventListener('click', () => renderProbationDetail(employeeId, data));

      document.querySelectorAll('[data-prob-result]').forEach(button => {
        button.addEventListener('click', async () => {
          const result = button.dataset.probResult;
          if (!await confirmSheet({
            title: result === 'pass' ? 'อนุมัติผ่านทดลองงาน?' : 'ขยายเวลาอีก 30 วัน?',
            desc: result === 'pass' ? 'ปิดเคสทดลองงาน (ผ่าน)' : 'ระบบจะสร้างรอบประเมินถัดไป (+30 วัน ตามรอบเงินเดือน) — กดซ้ำได้เรื่อยๆ จนกว่าจะอนุมัติผ่าน',
            confirmLabel: result === 'pass' ? 'อนุมัติผ่าน' : 'ขยาย +30 วัน'
          })) return;
          const restore = busyButton(button, result === 'pass' ? 'กำลังอนุมัติ...' : 'กำลังขยาย...');
          try {
            if (result === 'pass') {
              await api('/updateProbationCase', { caseId: button.dataset.case, status: 'completed', result: 'pass' });
              toast('อนุมัติผ่านทดลองงานแล้ว');
            } else {
              const r = await api('/extendProbation', { employeeId });
              toast(`ขยายเวลาแล้ว · สร้างรอบประเมิน ${r.day} วัน`);
            }
            adminCache = null;
            const fresh = await api('/adminData');
            adminCache = fresh;
            renderProbationDetail(employeeId, fresh);
          } catch (error) { restore(); toast(error.message, 'error'); }
        });
      });

      const remind = document.querySelector('[data-prob-remind]');
      if (remind) remind.addEventListener('click', () => {
        pendingMessageUserId = remind.dataset.probRemind;
        renderMessagesM3();
      });

      const evalBtn = document.querySelector('[data-prob-eval]');
      if (evalBtn) evalBtn.addEventListener('click', () => {
        openProbationEval(evalBtn.dataset.probEval, () => { adminCache = null; renderProbationHome(); });
      });
      document.querySelectorAll('[data-prob-print]').forEach(b => b.addEventListener('click', () => {
        openProbationPrint(b.dataset.probPrint, () => renderProbationDetail(employeeId, data));
      }));
    }

    /* ---- Probation evaluation form (dynamic template + scoring + draft autosave) ---- */
    let evalAutosaveTimer = null;
    let kpiRowSeq = 0;

    const DEFAULT_KPI_RUBRIC = {
      10: 'ทำงานได้ตรงตามมาตรฐาน ≥ 100% พร้อมหลักฐานการส่งตรงเวลา',
      8: 'ทำงานได้ตรงตามมาตรฐาน ≥ 95% พร้อมหลักฐานการส่งตรงเวลา',
      6: 'ทำงานได้ตรงตามมาตรฐาน ≥ 85%',
      4: 'ทำงานได้ตรงตามมาตรฐาน ≥ 75%',
      2: 'ต่ำกว่ามาตรฐาน ต้องปรับปรุง'
    };

    function defaultRubricFor(points) {
      const rubric = {};
      (points || []).forEach(p => { rubric[p] = DEFAULT_KPI_RUBRIC[p] || ''; });
      return rubric;
    }

    function kpiRowMarkup(idx, points, row, name) {
      const levels = points.map(p => `
        <label class="m3-kpi-level">
          <input type="radio" data-kpi-score name="${name}" value="${p}" ${String(row.score) === String(p) ? 'checked' : ''}>
          <span class="lvl">${p}</span>
          <input class="m3-kpi-desc" data-kpi-rubric="${p}" placeholder="ความหมายของคะแนน ${p}" value="${escapeHtml((row.rubric || {})[p] || '')}">
        </label>
      `).join('');
      return `
        <div class="m3-kpi-card" data-kpi-sec="${idx}">
          <input class="m3-kpi-topic" data-kpi-label placeholder="หัวข้อ KPI / หน้าที่ความรับผิดชอบ" value="${escapeHtml(row.label || '')}">
          <div class="m3-kpi-rubric-cap">เกณฑ์การให้คะแนน (เลือกระดับที่ได้)</div>
          <div class="m3-kpi-levels">${levels}</div>
          <button type="button" class="m3-kpi-remove" data-kpi-remove>${micon('delete')}ลบหัวข้อนี้</button>
        </div>
      `;
    }

    function gradeOf(total, bands) {
      const sorted = [...(bands || [])].sort((a, b) => b.min - a.min);
      for (const band of sorted) { if (total >= band.min) return band; }
      return sorted[sorted.length - 1] || { key: '-', label: '-' };
    }

    function defaultEvalState(template, submission, prevSubmission) {
      const saved = submission && submission.state ? submission.state : {};
      const prevState = prevSubmission && prevSubmission.state ? prevSubmission.state : {};
      const state = {};
      (template.sections || []).forEach((sec, idx) => {
        const prev = saved[idx] || {};
        if (sec.type === 'kpi') {
          const fallback = () => defaultRubricFor(sec.scale.points);
          const carried = prevState[idx] && prevState[idx].rows && prevState[idx].rows.length ? prevState[idx].rows : null;
          let rows;
          if (prev.rows && prev.rows.length) {
            // resume own draft / saved
            rows = prev.rows.map(r => ({ label: r.label || '', score: r.score || '', rubric: (r.rubric && Object.keys(r.rubric).length) ? r.rubric : fallback() }));
          } else if (carried) {
            // prefill topics + rubric from previous milestone, scores reset for the new round
            rows = carried.map(r => ({ label: r.label || '', score: '', rubric: (r.rubric && Object.keys(r.rubric).length) ? r.rubric : fallback() }));
          } else {
            rows = Array.from({ length: sec.minItems || 1 }, () => ({ label: '', score: '', rubric: fallback() }));
          }
          state[idx] = { rows };
        } else if (sec.type === 'competency') {
          const scores = (prev.scores && prev.scores.length) ? prev.scores : (sec.items || []).map(() => '');
          state[idx] = { scores };
        } else if (sec.type === 'attendance') {
          state[idx] = { counts: prev.counts || {} };
        } else if (sec.type === 'comment') {
          state[idx] = { text: prev.text || '' };
        }
      });
      return state;
    }

    function computeEval(template, state) {
      let total = 0;
      const perSection = {};
      (template.sections || []).forEach((sec, idx) => {
        const st = state[idx] || {};
        let score = 0;
        if (sec.type === 'kpi') {
          const rows = (st.rows || []).filter(r => Number(r.score) > 0);
          const max = sec.scale.max * rows.length;
          const sum = rows.reduce((s, r) => s + Number(r.score || 0), 0);
          score = max ? (sum / max) * sec.weight : 0;
        } else if (sec.type === 'competency') {
          const filled = (st.scores || []).map(Number).filter(v => v > 0);
          const max = sec.scale.max * filled.length;
          const sum = filled.reduce((s, v) => s + v, 0);
          score = max ? (sum / max) * sec.weight : 0;
        } else if (sec.type === 'attendance') {
          const counts = st.counts || {};
          const deduct = (sec.fields || []).reduce((d, f) => d + Number(counts[f.key] || 0) * Number(f.deduct || 0), 0);
          score = Math.max(0, sec.weight - deduct);
        }
        perSection[idx] = score;
        total += score;
      });
      return { total: Math.round(total), perSection };
    }

    function evalSectionMarkup(sec, idx, st) {
      const weightBadge = sec.weight != null ? `<span class="m3-sec-weight">${sec.weight}%</span>` : '';
      if (sec.type === 'kpi') {
        const rows = (st.rows || []).map((row, ri) => kpiRowMarkup(idx, sec.scale.points, row, `kpi-${idx}-${ri}`)).join('');
        return `
          <section class="m3-card m3-card-pad" data-sec="${idx}">
            <div class="m3-section-head"><h3 class="m3-section-label">${escapeHtml(sec.title)} (ขั้นต่ำ ${sec.minItems || 1} ข้อ)</h3>${weightBadge}</div>
            <div data-kpi-rows>${rows}</div>
            <button type="button" class="m3-btn m3-btn--ghost" data-kpi-add="${idx}" style="min-height:42px;margin-top:6px">${micon('add')}เพิ่มหัวข้อ KPI</button>
          </section>
        `;
      }
      if (sec.type === 'competency') {
        const items = (sec.items || []).map((item, i) => `
          <div class="m3-eval-item m3-eval-item--col" data-comp-sec="${idx}" data-i="${i}">
            <div class="t">${i + 1}. ${escapeHtml(item.label)}</div>
            ${m3ScaleButtons(`comp-${idx}-${i}`, sec.scale.points, (st.scores || [])[i], 'agree', sec.scale.labels)}
          </div>
        `).join('');
        return `
          <section class="m3-card m3-card-pad" data-sec="${idx}">
            <div class="m3-section-head"><h3 class="m3-section-label">${escapeHtml(sec.title)} (เต็ม ${sec.scale.max})</h3>${weightBadge}</div>
            ${items}
          </section>
        `;
      }
      if (sec.type === 'attendance') {
        const fields = (sec.fields || []).map(f => `
          <div class="m3-att-row">
            <div class="t"><div>${escapeHtml(f.label)}</div><div style="font-size:11px;color:var(--m3-on-surface-variant)">หัก ${f.deduct} คะแนน/หน่วย</div></div>
            <input class="m3-field-num" type="number" min="0" placeholder="0" data-att="${f.key}" value="${(st.counts || {})[f.key] != null ? escapeHtml((st.counts || {})[f.key]) : ''}">
          </div>
        `).join('');
        return `
          <section class="m3-card m3-card-pad" data-sec="${idx}">
            <div class="m3-section-head"><h3 class="m3-section-label">${escapeHtml(sec.title)} (เต็ม ${sec.weight})</h3>${weightBadge}</div>
            <p class="m3-save-hint" style="text-align:left;margin:0 0 10px">กรอก<strong>จำนวนจริง</strong>ตามบันทึกเวลา (เป็นวัน/ครั้ง) — <strong>ไม่ต้องใส่คะแนนเอง</strong> ระบบจะหักและคำนวณให้อัตโนมัติ ถ้าไม่มีให้ใส่ 0 หรือเว้นว่าง</p>
            ${fields}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--m3-outline-variant)">
              <span class="m3-progress-cap">คะแนนการมาปฏิบัติงาน</span>
              <strong style="color:var(--m3-primary);font-size:17px"><span data-att-score="${idx}">${sec.weight}</span> / ${sec.weight}</strong>
            </div>
          </section>
        `;
      }
      if (sec.type === 'comment') {
        return `
          <section class="m3-card m3-card-pad" data-sec="${idx}">
            <h3 class="m3-section-label" style="margin-bottom:8px">${escapeHtml(sec.title)}</h3>
            <textarea class="m3-textarea" data-comment placeholder="ความคิดเห็นเพิ่มเติม / จุดที่ต้องพัฒนา">${escapeHtml(st.text || '')}</textarea>
          </section>
        `;
      }
      return '';
    }

    function renderProbationEval(res, back) {
      const task = res.task;
      const template = res.probation.template;
      // normalize scale so a template saved with an empty/missing scale never throws downstream
      (template.sections || []).forEach(sec => {
        if (sec.type === 'kpi' || sec.type === 'competency') {
          sec.scale = sec.scale || {};
          if (!Array.isArray(sec.scale.points)) sec.scale.points = [];
          if (sec.scale.max == null) sec.scale.max = sec.scale.points.length ? Math.max(...sec.scale.points) : 0;
        }
      });
      const employeeName = res.probation.employeeName || res.task.target || '';
      const day = res.probation.day;
      let localDraft = null;
      try { const raw = localStorage.getItem(`noseTeaDraft:${task.taskId}`); if (raw) localDraft = JSON.parse(raw); } catch (e) {}
      const submission = (localDraft && localDraft.state) ? { state: localDraft.state } : (task.submission || null);
      let state = defaultEvalState(template, submission, res.probation.prevSubmission);

      const body = `
        <section class="m3-section" style="gap:4px">
          <h2 class="m3-title">ประเมินทดลองงาน ${day ? day + ' วัน' : ''}</h2>
          <p class="m3-eyebrow">${escapeHtml(employeeName)} · ${escapeHtml(template.name)}</p>
        </section>
        <div class="m3-eval-summary">
          <div><div class="cap">คะแนนรวม</div><div class="pct" id="evalPct">0%</div></div>
          <div class="m3-eval-grade"><div class="cap">เกรด</div><div class="g" id="evalGrade">-</div></div>
        </div>
        <div id="evalSections" style="display:flex;flex-direction:column;gap:16px">
          ${template.sections.map((sec, idx) => evalSectionMarkup(sec, idx, state[idx])).join('')}
        </div>
        <p class="m3-save-hint" id="evalHint" style="margin-top:6px">ระบบบันทึกร่างอัตโนมัติ</p>
        <section class="m3-section" style="gap:10px;margin-top:4px">
          <button type="button" class="m3-btn" data-eval-submit>${micon('check_circle')}ส่งผลประเมิน</button>
          <button type="button" class="m3-btn m3-btn--ghost" data-eval-draft>${micon('save')}บันทึกร่าง</button>
        </section>
        <div style="height:40px"></div>
      `;
      render(m3Shell('probation', body, { bar: { title: 'แบบประเมิน', back: true }, noNav: true }));
      wireM3Nav({ back });

      const container = document.getElementById('evalSections');
      const localKey = `noseTeaDraft:${task.taskId}`;

      const collectState = () => {
        const st = {};
        template.sections.forEach((sec, idx) => {
          if (sec.type === 'kpi') {
            st[idx] = { rows: [...container.querySelectorAll(`[data-kpi-sec="${idx}"]`)].map(card => {
              const checked = card.querySelector('[data-kpi-score]:checked');
              const rubric = {};
              card.querySelectorAll('[data-kpi-rubric]').forEach(inp => { rubric[inp.dataset.kpiRubric] = inp.value; });
              return { label: card.querySelector('[data-kpi-label]').value, score: checked ? checked.value : '', rubric };
            }) };
          } else if (sec.type === 'competency') {
            st[idx] = { scores: [...container.querySelectorAll(`.m3-eval-item[data-comp-sec="${idx}"]`)].map(item => {
              const checked = item.querySelector('input[type="radio"]:checked');
              return checked ? checked.value : '';
            }) };
          } else if (sec.type === 'attendance') {
            const counts = {};
            container.querySelectorAll(`[data-sec="${idx}"] [data-att]`).forEach(inp => { counts[inp.dataset.att] = inp.value; });
            st[idx] = { counts };
          } else if (sec.type === 'comment') {
            const ta = container.querySelector(`[data-sec="${idx}"] [data-comment]`);
            st[idx] = { text: ta ? ta.value : '' };
          }
        });
        return st;
      };

      const buildSubmission = () => {
        const calc = computeEval(template, state);
        const grade = gradeOf(calc.total, template.ratingBands);
        return {
          state, score: calc.total, perSection: calc.perSection,
          grade: grade.key, gradeLabel: grade.label, day, templateId: template.templateId,
          // freeze the scoring rule with the result so re-opening/printing never recomputes with an edited template
          template: { name: template.name, level: template.level, sections: template.sections, ratingBands: template.ratingBands }
        };
      };

      const hint = document.getElementById('evalHint');
      const autosave = () => {
        try { localStorage.setItem(localKey, JSON.stringify({ state, savedAt: Date.now() })); } catch (e) {}
        hint.textContent = 'บันทึกร่างในเครื่องแล้ว';
        hint.classList.add('saved');
        clearTimeout(evalAutosaveTimer);
        evalAutosaveTimer = setTimeout(async () => {
          try {
            await api('/saveTaskDraft', { taskId: task.taskId, submission: buildSubmission() });
            hint.textContent = 'บันทึกร่างขึ้นระบบแล้ว · กดออกได้ ข้อมูลไม่หาย';
          } catch (e) { hint.textContent = 'บันทึกในเครื่องแล้ว (ออนไลน์ผิดพลาด)'; }
        }, 1500);
      };

      const recompute = () => {
        state = collectState();
        const { total, perSection } = computeEval(template, state);
        const grade = gradeOf(total, template.ratingBands);
        document.getElementById('evalPct').textContent = `${total}%`;
        document.getElementById('evalGrade').textContent = grade.key;
        template.sections.forEach((sec, idx) => {
          if (sec.type === 'attendance') {
            const el = document.querySelector(`[data-att-score="${idx}"]`);
            if (el) el.textContent = Math.round(perSection[idx] || 0);
          }
        });
      };

      const onChange = () => { recompute(); autosave(); };
      container.addEventListener('input', onChange);
      container.addEventListener('change', onChange);

      container.querySelectorAll('[data-kpi-add]').forEach(button => {
        button.addEventListener('click', () => {
          const idx = button.dataset.kpiAdd;
          const sec = template.sections[idx];
          if (sec.maxItems && container.querySelectorAll(`[data-kpi-sec="${idx}"]`).length >= sec.maxItems) { toast(`เพิ่มได้สูงสุด ${sec.maxItems} ข้อ`, 'error'); return; }
          const rows = container.querySelector(`[data-sec="${idx}"] [data-kpi-rows]`);
          const wrap = document.createElement('div');
          wrap.innerHTML = kpiRowMarkup(idx, sec.scale.points, { label: '', score: '', rubric: defaultRubricFor(sec.scale.points) }, `kpi-${idx}-add${kpiRowSeq++}`);
          rows.appendChild(wrap.firstElementChild);
          recompute();
        });
      });

      container.addEventListener('click', event => {
        const rm = event.target.closest('[data-kpi-remove]');
        if (!rm) return;
        const row = rm.closest('[data-kpi-sec]');
        const idx = row.dataset.kpiSec;
        const sec = template.sections[idx];
        if (container.querySelectorAll(`[data-kpi-sec="${idx}"]`).length <= (sec.minItems || 1)) { toast(`ต้องมีอย่างน้อย ${sec.minItems || 1} ข้อ`, 'error'); return; }
        row.remove();
        onChange();
      });

      document.querySelector('[data-eval-draft]').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api('/saveTaskDraft', { taskId: task.taskId, submission: buildSubmission() });
          hint.textContent = 'บันทึกร่างแล้ว';
        } catch (e) { toast(e.message, 'error'); }
        button.disabled = false;
      });

      document.querySelector('[data-eval-submit]').addEventListener('click', async event => {
        recompute();
        for (let idx = 0; idx < template.sections.length; idx++) {
          const sec = template.sections[idx];
          if (sec.type === 'kpi') {
            const rows = state[idx].rows.filter(r => r.label.trim() || Number(r.score) > 0);
            if (rows.length < (sec.minItems || 1)) { toast(`กรุณากรอก ${sec.title} อย่างน้อย ${sec.minItems} ข้อ พร้อมให้คะแนน`, 'error'); return; }
            if (rows.some(r => !r.label.trim() || !(Number(r.score) > 0))) { toast(`กรุณากรอกหัวข้อและคะแนนให้ครบใน ${sec.title}`, 'error'); return; }
          }
          if (sec.type === 'competency' && state[idx].scores.some(s => !(Number(s) > 0))) {
            toast(`กรุณาให้คะแนนครบทุกข้อใน ${sec.title}`, 'error'); return;
          }
        }
        const restore = busyButton(event.currentTarget, 'กำลังส่ง...');
        try {
          await api('/submitTask', { taskId: task.taskId, submission: buildSubmission() });
          try { localStorage.removeItem(localKey); } catch (e) {}
          toast('ส่งผลประเมินเรียบร้อย');
          back();
        } catch (e) {
          restore();
          toast(e.message, 'error');
        }
      });

      recompute();
    }

    async function openProbationEval(taskId, back) {
      render(m3Loading('แบบประเมิน'));
      try {
        const res = await api('/getTask', { taskId });
        if (!res.probation || !res.probation.template) {
          toast('ไม่พบแบบฟอร์มประเมินสำหรับงานนี้', 'error');
          back();
          return;
        }
        renderProbationEval(res, back);
      } catch (error) {
        render(m3ErrorScreen(error.message));
      }
    }

    /* ---- Probation result — printable document (Export PDF) ---- */
    function pdocKpiSection(sec, st) {
      const rows = (st.rows || []).filter(r => (r.label || '').trim() || Number(r.score) > 0);
      if (!rows.length) return '<div class="pdoc-kpi">— ไม่มีข้อมูล —</div>';
      return rows.map((row, i) => {
        const levels = (sec.scale.points || []).map(p => {
          const sel = String(row.score) === String(p);
          return `<tr class="${sel ? 'sel' : ''}"><td class="lv ${sel ? 'sel' : ''}">${p}${sel ? ' ✓' : ''}</td><td>${escapeHtml((row.rubric || {})[p] || '')}</td></tr>`;
        }).join('');
        return `<div class="pdoc-kpi"><div class="pdoc-kpi-top">${i + 1}. ${escapeHtml(row.label || '-')} <span style="float:right">คะแนน: ${escapeHtml(row.score || '-')}/${sec.scale.max}</span></div><table class="pdoc-rub">${levels}</table></div>`;
      }).join('');
    }

    function pdocCompetencySection(sec, st) {
      const pts = sec.scale.points || [];
      const head = `<tr><th style="text-align:left">ปัจจัยการประเมิน</th>${pts.map(p => `<th class="col">${p}</th>`).join('')}</tr>`;
      const body = (sec.items || []).map((item, i) => {
        const score = (st.scores || [])[i];
        return `<tr><td>${i + 1}. ${escapeHtml(item.label)}</td>${pts.map(p => `<td class="col ${String(score) === String(p) ? 'dot' : ''}">${String(score) === String(p) ? '●' : ''}</td>`).join('')}</tr>`;
      }).join('');
      return `<table class="pdoc-comp">${head}${body}</table>`;
    }

    function pdocAttendanceSection(sec, st) {
      const counts = st.counts || {};
      const rows = (sec.fields || []).map(f => `<tr><td>${escapeHtml(f.label)}</td><td style="text-align:center;width:60px">${escapeHtml(counts[f.key] || 0)}</td><td style="text-align:center;width:80px">-${f.deduct}/หน่วย</td></tr>`).join('');
      return `<table class="pdoc-comp">${rows}</table>`;
    }

    const RATING_DEFS = [
      ['O', 'ผลการปฏิบัติงานโดดเด่น', 'ปฏิบัติงานได้ตรงตามที่ได้รับมอบหมาย และส่วนมากจะสามารถปฏิบัติได้เกินกว่าที่คาดหวังไว้', '95 ขึ้นไป'],
      ['VG', 'ผลการปฏิบัติงานดีมาก', 'ปฏิบัติงานได้ตรงตามที่ได้รับมอบหมาย และบ่อยครั้งที่ปฏิบัติหน้าที่ได้ดีเกินกว่าที่คาดหวังไว้', '85 - 94'],
      ['G', 'ผลการปฏิบัติงานดี', 'ปฏิบัติงานได้ตรงตามที่ได้รับมอบหมาย และบางครั้งปฏิบัติหน้าที่ได้ดีกว่ามาตรฐานที่กำหนด', '75 - 84'],
      ['N', 'ผลการปฏิบัติงานต้องปรับปรุง', 'ปฏิบัติหน้าที่ได้ตามที่ได้รับมอบหมายตามมาตรฐาน แต่ไม่สม่ำเสมอ บางครั้งจะปฏิบัติงานได้เกินและต่ำกว่ามาตรฐานที่ตั้งไว้ ต้องปรับปรุงการปฏิบัติงานเพื่อการจ้างงานต่อ', '65 - 74'],
      ['U', 'ผลการปฏิบัติงานไม่เป็นที่น่าพอใจ', 'นานๆ ครั้งจะสามารถปฏิบัติงานได้ตามมาตรฐาน ต้องปรับปรุงเพื่อการจ้างงาน หรือต้องการให้สิ้นสุดการจ้างงาน', 'ต่ำกว่า 65']
    ];

    const DEFAULT_RATING_BANDS = RATING_DEFS.map(([key, label, , range]) => ({
      key,
      label,
      min: /ต่ำกว่า/.test(String(range)) ? 0 : Number((String(range).match(/\d+/) || [0])[0])
    }));

    // Standard audit form letter from the template's level (manager→A, staff→B, operational→C),
    // so the official title/CSV stays consistent no matter what custom name HR gives the template.
    function probationFormLabel(level) {
      return level === 'manager' ? 'A' : level === 'operational' ? 'C' : 'B';
    }

    function probationPrintMarkup(res) {
      const p = res.probation;
      const submission = res.task.submission || { state: {} };
      const state = submission.state || {};
      // use the frozen template + score captured at submit time (fair: never recompute with an edited template)
      const template = submission.template || p.template;
      const calc = (submission.perSection && submission.score != null)
        ? { total: submission.score, perSection: submission.perSection }
        : computeEval(template, state);
      const grade = submission.grade ? { key: submission.grade, label: submission.gradeLabel } : gradeOf(calc.total, template.ratingBands);

      let secNo = 0;
      const sectionsHtml = template.sections.map((sec, idx) => {
        const st = state[idx] || {};
        if (sec.type === 'kpi') { secNo += 1; return `<div class="pdoc-sec">ส่วนที่ ${secNo} · หน้าที่ความรับผิดชอบหลัก (น้ำหนัก ${sec.weight}%)</div>${pdocKpiSection(sec, st)}`; }
        if (sec.type === 'competency') { secNo += 1; return `<div class="pdoc-sec">ส่วนที่ ${secNo} · ปัจจัยการประเมิน (น้ำหนัก ${sec.weight}%)</div>${pdocCompetencySection(sec, st)}`; }
        if (sec.type === 'attendance') { secNo += 1; return `<div class="pdoc-sec">ส่วนที่ ${secNo} · บันทึกเวลาการมาปฏิบัติงาน (น้ำหนัก ${sec.weight}%)</div>${pdocAttendanceSection(sec, st)}`; }
        return '';
      }).join('');

      const commentIdx = template.sections.findIndex(s => s.type === 'comment');
      const commentText = commentIdx >= 0 ? ((state[commentIdx] || {}).text || '') : '';

      const scoredSecRows = template.sections.map((sec, idx) => {
        if (!['kpi', 'competency', 'attendance'].includes(sec.type)) return '';
        const label = sec.type === 'kpi' ? 'หน้าที่ความรับผิดชอบหลัก' : (sec.type === 'competency' ? 'ปัจจัยผลการปฏิบัติงาน' : 'การมาปฏิบัติงาน');
        return `<tr><td>${label} (${sec.weight})</td><td style="text-align:right">${Math.round(calc.perSection[idx] || 0)}</td></tr>`;
      }).join('');

      const ratingRows = RATING_DEFS.map(([k, t, d, range]) =>
        `<tr><td style="width:30px;text-align:center;font-weight:700">${k}</td><td><b>${t}</b> — ${d}</td><td style="width:62px;text-align:center">${range}</td></tr>`).join('');

      const sign = (label) => `<tr><td style="padding:14px 0 2px">${label}</td><td style="padding:14px 0 2px;text-align:right">ลงชื่อ ......................................... วันที่ ................</td></tr>`;

      return `
        <div class="pdoc">
          <div class="pdoc-letterhead">
            <div style="display:flex;align-items:center;gap:8px"><img src="/assets/logo.png?v=20260619-22" alt="" style="height:34px;width:34px;object-fit:contain" onerror="this.remove()"><span style="font-weight:700;font-size:24px;color:#8fa17e;letter-spacing:.5px">nose tea</span></div>
            <div style="margin-left:auto;text-align:right;font-size:10px;color:#555;line-height:1.35">
              <b style="color:#426454">บริษัท โนส ที (ประเทศไทย) จำกัด</b><br>
              1213/251 ชั้นที่ 2 ซอยลาดพร้าว 94 (ปัญจมิตร)<br>
              แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10310
            </div>
          </div>
          <div class="pdoc-title">แบบประเมินผลการทดลองงาน (Form ${probationFormLabel(template.level || (p.template && p.template.level) || 'staff')})${p.day ? ` · รอบ ${p.day} วัน` : ''}</div>
          ${template.name ? `<div style="text-align:center;font-size:10px;color:#999;margin:-6px 0 8px">${escapeHtml(template.name)}</div>` : ''}
          <table class="info">
            <tr><td><b>ชื่อ-นามสกุล:</b> ${escapeHtml(p.employeeName || '-')}</td><td><b>หัวหน้างาน:</b> ${escapeHtml(p.supervisorName || '-')}</td></tr>
            <tr><td><b>ตำแหน่งงาน:</b> ${escapeHtml(p.position || '-')}</td><td><b>ฝ่าย/แผนก:</b> ${escapeHtml(p.department || '-')}</td></tr>
            <tr><td><b>รหัสพนักงาน:</b> ${escapeHtml(p.employeeCode || '-')}</td><td><b>สาขา:</b> ${escapeHtml(p.branch || '-')}</td></tr>
            <tr><td><b>ช่วงเวลาการประเมิน:</b> ${formatThaiDate(p.startDate)} – ${formatThaiDate(p.periodEnd)}${p.day ? ` (${p.day} วัน)` : ''}</td><td><b>วันที่ประเมิน:</b> ${p.evaluatedAt ? formatThaiDateTime(p.evaluatedAt) : '-'}</td></tr>
          </table>

          ${sectionsHtml}

          <div class="pdoc-sec">สรุปผลการปฏิบัติงาน</div>
          <table class="pdoc-sum">
            ${scoredSecRows}
            <tr class="pdoc-total"><td>คะแนนรวม</td><td style="text-align:right">${calc.total} / 100 &nbsp;—&nbsp; เกรด ${grade.key} (${escapeHtml(grade.label || '')})</td></tr>
          </table>

          <div class="pdoc-sec">คำจำกัดความของผลการปฏิบัติงาน (ช่วงเวลาทดลองงาน)</div>
          <table class="pdoc-sum">${ratingRows}</table>

          <div class="pdoc-sec">ความเห็นและการลงชื่อรับทราบ</div>
          <div style="font-size:12px;margin-bottom:3px">ความคิดเห็นเพิ่มเติม / ส่วนที่ต้องพัฒนา</div>
          <div class="pdoc-comment">${escapeHtml(commentText.trim() || '-')}</div>
          <div style="margin-top:8px;font-size:12px">
            <div style="font-weight:700;margin-bottom:3px">ความคิดเห็นของพนักงาน</div>
            <div>☐ ข้าพเจ้าเห็นด้วยและยอมรับในผลการประเมินและข้อเสนอแนะข้างต้น</div>
            <div>☐ ข้าพเจ้าไม่เห็นด้วยและยอมรับในผลการประเมินและข้อเสนอแนะข้างต้น ตามเหตุผลข้างล่างนี้</div>
            <div class="pdoc-comment" style="margin-top:4px;min-height:34px"></div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">
            ${sign('ลายเซ็นของพนักงาน')}
            ${sign('ลายเซ็นของต้นสังกัด / ผู้ประเมิน')}
            ${sign('ลายเซ็นของฝ่ายทรัพยากรมนุษย์ / ผู้ตรวจสอบ')}
            ${sign('ลายเซ็นของผู้บริหาร / ผู้อนุมัติ')}
          </table>

          <div class="pdoc-foot">บริษัท โนส ที (ประเทศไทย) จำกัด · เอกสารนี้พิมพ์จากระบบ Nose Tea HR Portal</div>
        </div>
      `;
    }

    async function openProbationPrint(taskId, back) {
      render(m3Loading('กำลังเตรียมเอกสาร'));
      try {
        const res = await api('/getTask', { taskId });
        if (!res.probation || !res.probation.template) { toast('ไม่พบแบบฟอร์ม', 'error'); back(); return; }
        if (!res.task.submission || !res.task.submission.state) { toast('ยังไม่มีผลประเมินสำหรับรอบนี้', 'error'); back(); return; }
        render(`
          <div class="pdoc-screen">
            <div class="pdoc-toolbar no-print" style="flex-direction:column;align-items:stretch">
              <div style="display:flex;gap:10px">
                <button type="button" class="m3-btn" id="pdocPrint" style="width:auto">${micon('print')}พิมพ์ / บันทึก PDF</button>
                <button type="button" class="m3-btn m3-btn--ghost" id="pdocBack" style="width:auto">${micon('arrow_back')}กลับ</button>
              </div>
              <p class="m3-save-hint" style="text-align:left;margin:4px 0 0">💡 บนคอม: ในหน้าพิมพ์ ตั้ง <strong>Margins = Minimum</strong> และปิด <strong>Headers and footers</strong> เพื่อให้เอกสารเต็มหน้าสวยที่สุด (ระบบตั้ง default ให้แล้ว แต่บางเบราว์เซอร์ทับค่า)</p>
            </div>
            ${probationPrintMarkup(res)}
          </div>
        `);
        document.getElementById('pdocPrint').addEventListener('click', () => window.print());
        document.getElementById('pdocBack').addEventListener('click', back);
      } catch (error) {
        render(m3ErrorScreen(error.message));
      }
    }

    /* ---- Onboarding form viewer + print (Feedback / Reflection / Attendance) ---- */
    const OB_FEEDBACK_FIELDS = [
      ['understanding', 'ความเข้าใจในงาน'],
      ['participation', 'การมีส่วนร่วม'],
      ['communication', 'การสื่อสาร'],
      ['adaptability', 'การปรับตัว'],
      ['responsibility', 'ความรับผิดชอบ']
    ];

    function obFormTitle(type) {
      if (type === 'Feedback') return 'แบบประเมินผู้เรียนรู้ (Feedback จาก Mentor)';
      if (type === 'Reflection') return 'แบบสะท้อนการเรียนรู้ (Reflection)';
      if (type === 'Attendance') return 'บันทึกการเข้าร่วมกิจกรรม (Attendance)';
      return 'แบบฟอร์ม Onboarding';
    }

    function obFormBodyMarkup(task) {
      const s = task.submission || {};
      if (task.taskType === 'Feedback') {
        let total = 0, answered = 0;
        const rows = OB_FEEDBACK_FIELDS.map(([k, label]) => {
          const v = Number(s[k] || 0);
          if (v) { total += v; answered += 1; }
          return `<tr><td>${label}</td><td style="text-align:right">${v ? v + ' / 10' : '-'}</td></tr>`;
        }).join('');
        const pct = answered ? Math.round((total / (answered * 10)) * 100) : 0;
        return `
          <div class="pdoc-sec">ผลการให้คะแนน</div>
          <table class="pdoc-sum">
            ${rows}
            <tr class="pdoc-total"><td>คะแนนรวม</td><td style="text-align:right">${total} / ${answered * 10} (${pct}%)</td></tr>
          </table>
          <div class="pdoc-sec">ข้อเสนอแนะเพิ่มเติม</div>
          <div class="pdoc-comment">${escapeHtml((s.comment || '').trim() || '-')}</div>`;
      }
      if (task.taskType === 'Reflection') {
        const block = (label, val) => `<div class="pdoc-sec">${label}</div><div class="pdoc-comment">${escapeHtml((val || '').trim() || '-')}</div>`;
        return `
          ${block('3 สิ่งที่ได้เรียนรู้', s.learnings)}
          ${block('2 เรื่องที่ยังท้าทาย', s.challenges)}
          ${block('1 ข้อเสนอแนะ', s.suggestion)}
          ${block('อยากให้ทีมช่วยอะไรเพิ่มเติม', s.support)}`;
      }
      return `
        <div class="pdoc-sec">รายละเอียดการเข้าร่วม</div>
        <table class="info">
          <tr><td><b>วันที่:</b> ${formatThaiDate(task.sessionDate || task.dueDate)}</td><td><b>เวลา:</b> ${escapeHtml(task.startTime || '-')} - ${escapeHtml(task.endTime || '-')}</td></tr>
          <tr><td><b>ห้อง / สถานที่:</b> ${escapeHtml(task.room || '-')}</td><td><b>สถานะ:</b> ${s.confirmed === 'yes' ? 'ยืนยันเข้าร่วมแล้ว ✓' : '-'}</td></tr>
        </table>`;
    }

    function obFormPrintMarkup(res, staff) {
      const task = res.task;
      const who = staff || {};
      return `
        <div class="pdoc">
          <div class="pdoc-letterhead">
            <div style="display:flex;align-items:center;gap:8px"><img src="/assets/logo.png?v=20260619-22" alt="" style="height:34px;width:34px;object-fit:contain" onerror="this.remove()"><span style="font-weight:700;font-size:24px;color:#8fa17e;letter-spacing:.5px">nose tea</span></div>
            <div style="margin-left:auto;text-align:right;font-size:10px;color:#555;line-height:1.35">
              <b style="color:#426454">บริษัท โนส ที (ประเทศไทย) จำกัด</b><br>
              1213/251 ชั้นที่ 2 ซอยลาดพร้าว 94 (ปัญจมิตร)<br>
              แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10310
            </div>
          </div>
          <div class="pdoc-title">${obFormTitle(task.taskType)}</div>
          <table class="info">
            <tr><td><b>ชื่อ-นามสกุล:</b> ${escapeHtml(who.name || task.target || '-')}</td><td><b>Mentor:</b> ${escapeHtml(who.mentorName || '-')}</td></tr>
            <tr><td><b>ตำแหน่งงาน:</b> ${escapeHtml(who.position || '-')}</td><td><b>กลุ่ม:</b> ${escapeHtml(who.groupName || '-')}</td></tr>
            <tr><td><b>งาน:</b> ${escapeHtml(task.title || task.taskType)}</td><td><b>ครบกำหนด:</b> ${formatThaiDate(task.dueDate)}</td></tr>
            <tr><td><b>ประเภทแบบฟอร์ม:</b> ${escapeHtml(task.taskType)}</td><td><b>วันที่ส่ง:</b> ${task.submittedAt ? formatThaiDateTime(task.submittedAt) : '-'}</td></tr>
          </table>

          ${obFormBodyMarkup(task)}

          <div class="pdoc-foot">บริษัท โนส ที (ประเทศไทย) จำกัด · เอกสารนี้พิมพ์จากระบบ Nose Tea HR Portal</div>
        </div>`;
    }

    async function openObFormView(taskId, staff, back) {
      render(m3Loading('กำลังเปิดผลแบบฟอร์ม'));
      try {
        const res = await api('/getTask', { taskId });
        if (!res.task) { toast('ไม่พบแบบฟอร์ม', 'error'); back(); return; }
        if (res.task.status !== 'Completed') { toast('แบบฟอร์มนี้ยังไม่ถูกส่ง', 'error'); back(); return; }
        render(`
          <div class="pdoc-screen">
            <div class="pdoc-toolbar no-print">
              <button type="button" class="m3-btn" id="obDocPrint" style="width:auto">${micon('print')}พิมพ์ / บันทึก PDF</button>
              <button type="button" class="m3-btn m3-btn--ghost" id="obDocBack" style="width:auto">${micon('arrow_back')}กลับ</button>
            </div>
            ${obFormPrintMarkup(res, staff)}
          </div>
        `);
        document.getElementById('obDocPrint').addEventListener('click', () => window.print());
        document.getElementById('obDocBack').addEventListener('click', back);
      } catch (error) {
        render(m3ErrorScreen(error.message));
      }
    }

    /* ---- Probation template builder (HR) ---- */
    const ATT_DEFAULT_FIELDS = [
      { key: 'absent', label: 'ขาดงาน (วัน)', deduct: 5 },
      { key: 'late', label: 'มาสาย (ครั้ง)', deduct: 1 },
      { key: 'personalLeave', label: 'ลากิจ (วัน)', deduct: 1 },
      { key: 'sickLeave', label: 'ลาป่วย (วัน)', deduct: 0.5 },
      { key: 'otherLeave', label: 'ลาอื่นๆ (วัน)', deduct: 1 }
    ];

    function sectionTypeLabel(type) {
      return { kpi: 'KPI / หน้าที่หลัก', competency: 'Competency / ปัจจัย', attendance: 'การมาปฏิบัติงาน', comment: 'ความเห็น' }[type] || type;
    }

    function newTemplateSection(type) {
      if (type === 'kpi') return { type, title: 'หน้าที่ความรับผิดชอบหลัก', weight: 30, scale: { max: 10, points: [10, 8, 6, 4, 2] }, minItems: 3, maxItems: 10, items: [] };
      if (type === 'competency') return { type, title: 'ปัจจัยการประเมิน', weight: 30, scale: { max: 5, points: [5, 4, 3, 2, 1] }, minItems: 3, maxItems: 20, items: [{ label: '' }] };
      if (type === 'attendance') return { type, title: 'การมาปฏิบัติงาน', weight: 40, fields: JSON.parse(JSON.stringify(ATT_DEFAULT_FIELDS)) };
      return { type: 'comment', title: 'ความเห็นและส่วนที่ต้องพัฒนา' };
    }

    function renderTemplateList(data) {
      const templates = data.probationTemplates || [];
      // Lock a template only once a probation round using it has been EVALUATED (Completed) —
      // not merely assigned. So a test-assigned-but-never-evaluated form stays editable.
      const evaluatedEmps = new Set((data.tasks || [])
        .filter(t => t.taskType === 'Probation' && t.status === 'Completed')
        .map(t => t.employeeId));
      const usedIds = new Set((data.probationCases || [])
        .filter(c => evaluatedEmps.has(c.employeeId))
        .map(c => c.templateId).filter(Boolean));
      const active = templates.filter(t => t.active !== false);
      const trashed = templates.filter(t => t.active === false);
      const card = tpl => {
        const sum = (tpl.sections || []).filter(s => ['kpi', 'competency', 'attendance'].includes(s.type)).reduce((a, s) => a + Number(s.weight || 0), 0);
        const parts = (tpl.sections || []).filter(s => s.weight != null).map(s => `${sectionTypeLabel(s.type).split(' ')[0]} ${s.weight}%`).join(' · ');
        const locked = usedIds.has(tpl.templateId);
        return `
          <div class="m3-tpl-card">
            <div class="nm">${escapeHtml(tpl.name)} ${locked ? '<span class="m3-badge" style="vertical-align:middle">🔒 ประเมินแล้ว</span>' : ''}</div>
            <div class="sub">${escapeHtml(parts || 'ไม่มีส่วนให้คะแนน')} · รวม ${sum}%</div>
            <div class="m3-tpl-actions">
              <button type="button" class="m3-btn m3-btn--tonal" data-tpl-edit="${escapeHtml(tpl.templateId)}">${micon(locked ? 'visibility' : 'edit')}${locked ? 'ดู' : 'แก้ไข'}</button>
              <button type="button" class="m3-btn m3-btn--ghost" data-tpl-clone="${escapeHtml(tpl.templateId)}">${micon('content_copy')}คัดลอก</button>
              <button type="button" class="m3-btn m3-btn--ghost" data-tpl-disable="${escapeHtml(tpl.templateId)}" style="color:var(--m3-error)">${micon('block')}ปิดใช้งาน</button>
            </div>
          </div>`;
      };
      const body = `
        <section class="m3-section">
          <h2 class="m3-title">แบบฟอร์มประเมิน</h2>
          <p class="m3-eyebrow">สร้าง/แก้ไขฟอร์มทดลองงาน · ฟอร์มจะถูกล็อก (🔒) เมื่อ <strong>มีการประเมินจริง (ส่งผลแล้ว)</strong> เพื่อความเป็นธรรม — แก้โดยคัดลอกเป็นเวอร์ชันใหม่ · assign เฉยๆ ยังแก้ได้</p>
          <div style="display:flex;gap:10px">
            <button type="button" class="m3-btn" data-tpl-new>${micon('add')}สร้างใหม่</button>
            ${data.isOwner ? `<button type="button" class="m3-btn m3-btn--ghost" data-tpl-audit>${micon('history')}ประวัติการแก้ไข</button>` : ''}
          </div>
        </section>
        <section class="m3-section">
          ${active.map(card).join('') || '<div class="m3-empty">ยังไม่มีแบบฟอร์มที่ใช้งาน</div>'}
        </section>
        ${trashed.length ? `
        <section class="m3-section">
          <h3 class="m3-section-label">${micon('delete')} ถังขยะ (กู้คืนได้)</h3>
          ${trashed.map(tpl => `
            <div class="m3-tpl-card" style="opacity:.75">
              <div class="nm">${escapeHtml(tpl.name)}</div>
              <div class="sub">ปิดใช้งานอยู่</div>
              <div class="m3-tpl-actions">
                <button type="button" class="m3-btn m3-btn--tonal" data-tpl-restore="${escapeHtml(tpl.templateId)}">${micon('restore_from_trash')}กู้คืน</button>
              </div>
            </div>`).join('')}
        </section>` : ''}
      `;
      render(m3Shell('probation', body, { bar: { title: 'แบบฟอร์มประเมิน', back: true } }));
      wireM3Nav({ back: () => renderProbationHome() });
      document.querySelector('[data-tpl-new]').addEventListener('click', () => renderProbationTemplateEditor(null, data));
      const auditBtn = document.querySelector('[data-tpl-audit]');
      if (auditBtn) auditBtn.addEventListener('click', () => renderAuditLog(data));
      document.querySelectorAll('[data-tpl-edit]').forEach(b => b.addEventListener('click', () => {
        renderProbationTemplateEditor(templates.find(t => t.templateId === b.dataset.tplEdit), data, usedIds.has(b.dataset.tplEdit));
      }));
      document.querySelectorAll('[data-tpl-clone]').forEach(b => b.addEventListener('click', () => {
        const tpl = templates.find(t => t.templateId === b.dataset.tplClone);
        const copy = JSON.parse(JSON.stringify(tpl));
        copy.templateId = '';
        copy.name = `${tpl.name} (คัดลอก)`;
        renderProbationTemplateEditor(copy, data);
      }));
      document.querySelectorAll('[data-tpl-restore]').forEach(b => b.addEventListener('click', async () => {
        try {
          await api('/deleteProbationTemplate', { templateId: b.dataset.tplRestore, active: 1 });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          renderTemplateList(fresh);
        } catch (e) { toast(e.message, 'error'); }
      }));
      document.querySelectorAll('[data-tpl-disable]').forEach(b => b.addEventListener('click', async () => {
        const tpl = templates.find(t => t.templateId === b.dataset.tplDisable);
        if (!await confirmSheet({ title: `ปิดใช้งาน "${tpl ? tpl.name : ''}"?`, desc: 'ย้ายเข้าถังขยะ — จะไม่ขึ้นให้เลือกตอนมอบหมายใหม่ · ผลประเมินเก่าและ case ที่กำลังใช้อยู่ไม่กระทบ · กู้คืนได้', confirmLabel: 'ปิดใช้งาน', danger: true })) return;
        try {
          await api('/deleteProbationTemplate', { templateId: b.dataset.tplDisable, active: 0 });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          toast('ปิดใช้งานแบบฟอร์มแล้ว');
          renderTemplateList(fresh);
        } catch (e) { toast(e.message, 'error'); }
      }));
    }

    function renderAuditLog(data) {
      const logs = data.adminLogs || [];
      const labels = { template_create: 'สร้างแบบฟอร์ม', template_update: 'แก้ไขแบบฟอร์ม', template_trash: 'ย้ายฟอร์มไปถังขยะ', template_restore: 'กู้คืนแบบฟอร์ม', probation_assign: 'มอบหมายการประเมิน', probation_result: 'สรุปผลทดลองงาน', login: 'เข้าสู่ระบบ', register: 'ลงทะเบียนใหม่', user_role_change: 'เปลี่ยนสิทธิ์ผู้ใช้' };
      const body = `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">ประวัติการแก้ไข</h2><p class="m3-eyebrow">บันทึกว่าใครทำอะไรเมื่อไร (audit trail) · ล่าสุด ${logs.length} รายการ</p></section>
        <section class="m3-section">
          ${logs.length ? `<div class="m3-list">${logs.map(l => `
            <div class="m3-list-item">
              <div class="m3-list-icon">${micon(String(l.action || '').startsWith('template') ? 'description' : 'verified')}</div>
              <div class="m3-list-body">
                <p class="m3-list-title"><strong>${escapeHtml(labels[l.action] || l.action)}</strong>${l.detail ? ' · ' + escapeHtml(l.detail) : ''}</p>
                <p class="m3-list-sub">${escapeHtml(l.userName || '-')} · ${formatThaiDateTime(l.createdAt)}</p>
              </div>
            </div>`).join('')}</div>` : '<div class="m3-empty">ยังไม่มีบันทึก</div>'}
        </section>`;
      render(m3Shell('profile', body, { bar: { title: 'ประวัติการแก้ไข', back: true } }));
      wireM3Nav({ back: () => renderTemplateList(data) });
    }

    function renderProbationTemplateEditor(template, data, locked) {
      const editor = template
        ? JSON.parse(JSON.stringify({ templateId: template.templateId || '', name: template.name || '', level: template.level || 'staff', sections: template.sections || [], ratingBands: template.ratingBands || [], selfReviewEnabled: Boolean(template.selfReviewEnabled) }))
        : { templateId: '', name: '', level: 'staff', sections: [], ratingBands: [], selfReviewEnabled: false };
      const isLocked = Boolean(locked);

      const scoredSum = () => editor.sections.filter(s => ['kpi', 'competency', 'attendance'].includes(s.type)).reduce((a, s) => a + Number(s.weight || 0), 0);

      function sectionCard(sec, i) {
        let inner = `<label class="m3-elabel">ชื่อหัวข้อ</label><input class="m3-input" data-sec-field="title" data-i="${i}" value="${escapeHtml(sec.title || '')}">`;
        if (sec.type !== 'comment') inner += `<label class="m3-elabel">น้ำหนัก (%)</label><input class="m3-input" type="number" min="0" max="100" data-sec-field="weight" data-i="${i}" value="${sec.weight != null ? sec.weight : ''}">`;
        if (sec.type === 'kpi' || sec.type === 'competency') {
          inner += `<label class="m3-elabel">ระดับคะแนน (คั่นด้วยจุลภาค)</label><input class="m3-input" data-sec-field="points" data-i="${i}" value="${((sec.scale && sec.scale.points) || []).join(',')}">`;
          inner += `<label class="m3-elabel">จำนวนข้อขั้นต่ำ</label><input class="m3-input" type="number" min="1" data-sec-field="minItems" data-i="${i}" value="${sec.minItems || 1}">`;
        }
        if (sec.type === 'competency') {
          inner += `<label class="m3-elabel">หัวข้อปัจจัย</label><div>${(sec.items || []).map((it, j) => `<div class="m3-eitem"><input class="m3-input" data-comp-item="${i}" data-j="${j}" value="${escapeHtml(it.label || '')}"><button type="button" class="m3-iconbtn" data-comp-remove="${i}" data-j="${j}" style="color:var(--m3-error)">${micon('close')}</button></div>`).join('')}</div>`;
          inner += `<button type="button" class="m3-btn m3-btn--ghost" data-comp-add="${i}" style="min-height:40px">${micon('add')}เพิ่มปัจจัย</button>`;
          const cpts = (sec.scale && sec.scale.points) || [];
          inner += `<label class="m3-elabel" style="margin-top:10px">คำอธิบายแต่ละระดับ (เว้นว่าง = ใช้คำมาตรฐาน)</label><div>${cpts.map((p, k) => `<div class="m3-eitem"><span style="min-width:34px;text-align:center;font-weight:700;color:var(--m3-primary)">${escapeHtml(String(p))}</span><input class="m3-input" data-comp-label="${i}" data-k="${k}" value="${escapeHtml(((sec.scale && sec.scale.labels) || [])[k] || '')}" placeholder="${escapeHtml(defaultCaptionFor('agree', p, cpts))}"></div>`).join('')}</div>`;
          if (cpts.length) inner += `<button type="button" class="m3-btn m3-btn--ghost" data-comp-fill="${i}" style="min-height:38px;margin-top:4px">${micon('auto_fix_high')}ใช้คำมาตรฐาน</button>`;
        }
        if (sec.type === 'attendance') {
          inner += `<label class="m3-elabel">รายการหักคะแนน (คำอธิบาย / หักต่อหน่วย)</label><div>${(sec.fields || []).map((f, j) => `<div class="m3-eitem"><input class="m3-input" data-att-label="${i}" data-j="${j}" value="${escapeHtml(f.label || '')}"><input class="m3-field-num" type="number" step="0.5" data-att-deduct="${i}" data-j="${j}" value="${f.deduct != null ? f.deduct : 0}"></div>`).join('')}</div>`;
        }
        return `<section class="m3-card m3-card-pad" style="margin-bottom:14px"><div class="m3-section-head"><h3 class="m3-section-label">${sectionTypeLabel(sec.type)}</h3><button type="button" class="m3-iconbtn" data-sec-remove="${i}" style="color:var(--m3-error)">${micon('delete')}</button></div>${inner}</section>`;
      }

      function paint() {
        const sum = scoredSum();
        const body = `
          ${isLocked ? `<div class="m3-assign-card" style="background:var(--m3-warn-bg);border-color:var(--m3-warn-fg);margin-bottom:6px"><div class="cap" style="color:var(--m3-warn-fg)">🔒 ฟอร์มนี้ถูกใช้ประเมินแล้ว — แก้ของเดิมไม่ได้ การบันทึกจะสร้างเป็น <strong>เวอร์ชันใหม่</strong> (ของเดิมและผลประเมินเก่าไม่เปลี่ยน)</div></div>` : ''}
          <section class="m3-section" style="gap:6px">
            <label class="m3-elabel">ชื่อแบบฟอร์ม</label>
            <input class="m3-input" id="tplName" value="${escapeHtml(editor.name)}" placeholder="เช่น Form A — ระดับผู้จัดการ">
            <label class="m3-elabel">ระดับ</label>
            <select class="m3-select" id="tplLevel">${['manager', 'staff', 'operational'].map(l => `<option value="${l}" ${editor.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <span class="m3-badge ${sum === 100 ? 'm3-badge--ok' : 'm3-badge--warn'}" id="tplSum" style="align-self:flex-start">น้ำหนักรวม ${sum}/100</span>
          </section>
          <div id="tplSections">${editor.sections.map((s, i) => sectionCard(s, i)).join('') || '<div class="m3-empty">ยังไม่มีส่วน · เพิ่มจากปุ่มด้านล่าง</div>'}</div>
          <div class="m3-chip-row" style="margin:0">
            <button type="button" class="m3-chip" data-add-sec="kpi">${micon('add')}KPI</button>
            <button type="button" class="m3-chip" data-add-sec="competency">${micon('add')}Competency</button>
            <button type="button" class="m3-chip" data-add-sec="attendance">${micon('add')}Attendance</button>
            <button type="button" class="m3-chip" data-add-sec="comment">${micon('add')}ความเห็น</button>
          </div>
          <section class="m3-card m3-card-pad" style="margin:14px 0">
            <div class="m3-section-head">
              <h3 class="m3-section-label">เกณฑ์เกรด (ตามคะแนนรวม 0–100)</h3>
              ${editor.ratingBands.length ? '' : `<button type="button" class="m3-chip" id="rbDefault">${micon('auto_fix_high')}ใช้เกณฑ์มาตรฐาน</button>`}
            </div>
            ${editor.ratingBands.length ? `
              <div class="m3-eitem" style="gap:6px;font-size:11px;color:var(--m3-muted);text-transform:uppercase">
                <span style="max-width:64px;width:64px">เกรด</span><span style="flex:1">คำอธิบาย</span><span style="width:84px">คะแนนขั้นต่ำ</span><span style="width:32px"></span>
              </div>
              <div id="rbList">${editor.ratingBands.map((b, k) => `
                <div class="m3-eitem" style="gap:6px">
                  <input class="m3-input" style="max-width:64px;width:64px;text-align:center" data-rb-field="key" data-i="${k}" value="${escapeHtml(b.key || '')}" placeholder="O">
                  <input class="m3-input" data-rb-field="label" data-i="${k}" value="${escapeHtml(b.label || '')}" placeholder="คำอธิบายเกรด">
                  <input class="m3-field-num" style="width:84px" type="number" min="0" max="100" data-rb-field="min" data-i="${k}" value="${b.min != null ? b.min : ''}" placeholder="0">
                  <button type="button" class="m3-iconbtn" data-rb-remove="${k}" style="color:var(--m3-error)">${micon('close')}</button>
                </div>`).join('')}</div>
              <button type="button" class="m3-btn m3-btn--ghost" id="rbAdd" style="min-height:40px;margin-top:8px">${micon('add')}เพิ่มเกรด</button>
              <div class="cap" style="margin-top:8px;color:var(--m3-muted)">เรียงอัตโนมัติจากคะแนนสูง→ต่ำ · ควรมีเกรดที่คะแนนขั้นต่ำ = 0 เพื่อครอบคลุมคะแนนต่ำสุด</div>
            ` : '<div class="m3-empty" style="margin-top:8px">ยังไม่ได้ตั้งเกณฑ์เกรด · กด “ใช้เกณฑ์มาตรฐาน” หรือเพิ่มเอง</div>'}
          </section>
          <section class="m3-card m3-card-pad" style="margin:14px 0">
            <div class="m3-section-head"><h3 class="m3-section-label">ให้พนักงานประเมินตนเอง (self-review)</h3></div>
            <p class="m3-save-hint" style="text-align:left;margin:0 0 10px">พนักงานให้คะแนนตนเอง (หัวข้อ KPI + Competency) <strong>หลังหัวหน้าประเมินรอบนั้นเสร็จ</strong> · เห็นเฉพาะข้อมูลการมาทำงานจริง ไม่เห็นคะแนนหัวหน้า · เป็นข้อมูลเทียบ (gap) ให้ HR เท่านั้น · <strong>ไม่กระทบคะแนนผ่าน/ไม่ผ่าน</strong></p>
            ${editor.templateId
              ? `<button type="button" class="m3-btn ${editor.selfReviewEnabled ? '' : 'm3-btn--outline'}" id="tplSelfToggle">${micon(editor.selfReviewEnabled ? 'toggle_on' : 'toggle_off')}${editor.selfReviewEnabled ? 'เปิดอยู่ · แตะเพื่อปิด' : 'ปิดอยู่ · แตะเพื่อเปิด'}</button>`
              : `<p class="m3-eyebrow" style="margin:0">บันทึกแบบฟอร์มก่อน จึงจะเปิดการประเมินตนเองได้</p>`}
          </section>
          <section class="m3-section" style="gap:10px;margin-top:10px">
            <button type="button" class="m3-btn" id="tplSave">${micon('save')}${isLocked ? 'บันทึกเป็นเวอร์ชันใหม่ (คัดลอก)' : 'บันทึกแบบฟอร์ม'}</button>
            ${editor.templateId && !isLocked ? `<button type="button" class="m3-btn m3-btn--outline" id="tplDelete" style="color:var(--m3-error);border-color:var(--m3-error)">${micon('delete')}ย้ายไปถังขยะ (กู้คืนได้)</button>` : ''}
          </section>
          <div style="height:30px"></div>
        `;
        document.getElementById('tplEditor').innerHTML = body;
        bind();
      }

      function bind() {
        document.getElementById('tplName').addEventListener('input', e => { editor.name = e.target.value; });
        document.getElementById('tplLevel').addEventListener('change', e => { editor.level = e.target.value; });
        const wrap = document.getElementById('tplSections');
        wrap.addEventListener('input', e => {
          const t = e.target;
          if (t.dataset.secField != null) {
            const sec = editor.sections[+t.dataset.i];
            const f = t.dataset.secField;
            if (f === 'title') sec.title = t.value;
            else if (f === 'weight') { sec.weight = Number(t.value || 0); const chip = document.getElementById('tplSum'); const sum = scoredSum(); chip.textContent = `น้ำหนักรวม ${sum}/100`; chip.className = `m3-badge ${sum === 100 ? 'm3-badge--ok' : 'm3-badge--warn'}`; }
            else if (f === 'minItems') sec.minItems = Number(t.value || 1);
            else if (f === 'points') { const pts = t.value.split(',').map(x => Number(x.trim())).filter(x => !Number.isNaN(x)); sec.scale = sec.scale || {}; sec.scale.points = pts; sec.scale.max = pts.length ? Math.max(...pts) : 0; }
          } else if (t.dataset.compItem != null) { editor.sections[+t.dataset.compItem].items[+t.dataset.j].label = t.value; }
          else if (t.dataset.compLabel != null) { const s = editor.sections[+t.dataset.compLabel]; s.scale = s.scale || {}; s.scale.labels = s.scale.labels || []; s.scale.labels[+t.dataset.k] = t.value; }
          else if (t.dataset.attLabel != null) { editor.sections[+t.dataset.attLabel].fields[+t.dataset.j].label = t.value; }
          else if (t.dataset.attDeduct != null) { editor.sections[+t.dataset.attDeduct].fields[+t.dataset.j].deduct = Number(t.value || 0); }
        });
        // Re-render the per-level caption inputs to match a changed score scale (fires on blur).
        wrap.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.secField === 'points') paint(); });
        wrap.addEventListener('click', e => {
          const rm = e.target.closest('[data-sec-remove]');
          if (rm) { editor.sections.splice(+rm.dataset.secRemove, 1); paint(); return; }
          const ca = e.target.closest('[data-comp-add]');
          if (ca) { const i = +ca.dataset.compAdd; editor.sections[i].items = editor.sections[i].items || []; editor.sections[i].items.push({ label: '' }); paint(); return; }
          const cr = e.target.closest('[data-comp-remove]');
          if (cr) { editor.sections[+cr.dataset.compRemove].items.splice(+cr.dataset.j, 1); paint(); return; }
          const cf = e.target.closest('[data-comp-fill]');
          if (cf) { const s = editor.sections[+cf.dataset.compFill]; const pts = (s.scale && s.scale.points) || []; s.scale = s.scale || {}; s.scale.labels = pts.map(p => defaultCaptionFor('agree', p, pts)); paint(); return; }
        });
        document.querySelectorAll('[data-add-sec]').forEach(b => b.addEventListener('click', () => { editor.sections.push(newTemplateSection(b.dataset.addSec)); paint(); }));
        const rbList = document.getElementById('rbList');
        if (rbList) rbList.addEventListener('input', e => {
          const t = e.target;
          if (t.dataset.rbField == null) return;
          const band = editor.ratingBands[+t.dataset.i];
          if (t.dataset.rbField === 'min') band.min = Number(t.value || 0);
          else band[t.dataset.rbField] = t.value;
        });
        const rbAdd = document.getElementById('rbAdd');
        if (rbAdd) rbAdd.addEventListener('click', () => { editor.ratingBands.push({ key: '', label: '', min: 0 }); paint(); });
        const rbDefault = document.getElementById('rbDefault');
        if (rbDefault) rbDefault.addEventListener('click', () => { editor.ratingBands = JSON.parse(JSON.stringify(DEFAULT_RATING_BANDS)); paint(); });
        const rbWrap = document.getElementById('rbList');
        if (rbWrap) rbWrap.addEventListener('click', e => {
          const rm = e.target.closest('[data-rb-remove]');
          if (rm) { editor.ratingBands.splice(+rm.dataset.rbRemove, 1); paint(); }
        });
        document.getElementById('tplSave').addEventListener('click', save);
        const selfToggle = document.getElementById('tplSelfToggle');
        if (selfToggle) selfToggle.addEventListener('click', async () => {
          const next = !editor.selfReviewEnabled;
          const restore = busyButton(selfToggle);
          try {
            await api('/setTemplateSelfReview', { templateId: editor.templateId, enabled: next });
            editor.selfReviewEnabled = next;
            adminCache = null;
            toast(next ? 'เปิดการประเมินตนเองแล้ว' : 'ปิดการประเมินตนเองแล้ว');
            paint();
          } catch (error) { restore(); toast(error.message, 'error'); }
        });
        const del = document.getElementById('tplDelete');
        if (del) del.addEventListener('click', remove);
      }

      async function save() {
        const sum = scoredSum();
        if (!editor.name.trim()) { toast('กรุณาตั้งชื่อแบบฟอร์ม', 'error'); return; }
        if (sum !== 100) { toast(`น้ำหนักรวมต้องเท่ากับ 100 (ตอนนี้ ${sum})`, 'error'); return; }
        if (!editor.ratingBands.length && !await confirmSheet({ title: 'ยังไม่ได้ตั้งเกณฑ์เกรด', desc: 'ผลประเมินจะไม่แสดงเกรด (O/VG/G/N/U) ต้องการบันทึกต่อไหม?', confirmLabel: 'บันทึกต่อ' })) return;
        // locked template → save as a brand-new version (clone) so existing evaluations stay fair
        const saveId = isLocked ? '' : editor.templateId;
        const restore = busyButton(document.getElementById('tplSave'));
        try {
          await api('/saveProbationTemplate', { templateId: saveId, name: editor.name, level: editor.level, sections: editor.sections, ratingBands: editor.ratingBands });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          toast('บันทึกแบบฟอร์มแล้ว');
          renderTemplateList(fresh);
        } catch (error) { restore(); toast(error.message, 'error'); }
      }

      async function remove() {
        if (!await confirmSheet({ title: 'ย้ายแบบฟอร์มไปถังขยะ?', desc: 'กู้คืนได้ภายหลังจากหน้ารายการแบบฟอร์ม', confirmLabel: 'ย้ายไปถังขยะ' })) return;
        try {
          await api('/deleteProbationTemplate', { templateId: editor.templateId, active: 0 });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          renderTemplateList(fresh);
        } catch (error) { toast(error.message, 'error'); }
      }

      render(m3Shell('probation', `<div id="tplEditor"></div>`, { bar: { title: editor.templateId ? 'แก้ไขแบบฟอร์ม' : 'สร้างแบบฟอร์ม', back: true } }));
      wireM3Nav({ back: () => renderTemplateList(data) });
      paint();
    }

    /* ===================================================================
       MENTEE / MENTOR PORTAL (Material 3)  — Step 4
       =================================================================== */

    // Local (Thailand) YYYY-MM-DD — avoids the UTC roll-back that toISOString() causes in the evening.
    function todayIsoLocal() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

    // Proactive "what needs your attention now" card. Surfaces ONLY urgent/actionable items
    // (overdue work + unlocked self-reviews + evaluations that slipped) so it never duplicates the
    // normal task lists below. Renders nothing when there's nothing to act on. Free — no LINE quota.
    // Each item carries a data-attr already wired by the host screen (data-ptask / data-self-review / data-ac-prob).
    function actionCenterCard(items) {
      if (!items.length) return '';
      return `
        <section class="m3-section">
          <div class="m3-card m3-card-pad" style="border-color:var(--m3-primary)">
            <div class="m3-section-head" style="margin-bottom:2px"><h3 class="m3-section-label" style="margin:0">${micon('bolt')}สิ่งที่ต้องทำ</h3><span class="m3-badge m3-badge--warn">${items.length}</span></div>
            ${items.map(it => `
              <button type="button" class="m3-task-btn m3-pressable" ${it.attr || ''} style="margin-top:8px">
                <div style="display:flex;gap:12px;align-items:center">
                  <div class="m3-list-icon"${it.urgent ? ' style="background:#fbe7d6;color:#a8551f"' : ''}>${micon(it.icon)}</div>
                  <div style="flex:1;min-width:0;text-align:left"><div class="m3-staff-name">${escapeHtml(it.title)}</div>${it.sub ? `<div class="m3-list-sub">${escapeHtml(it.sub)}</div>` : ''}</div>
                  ${micon('chevron_right')}
                </div>
              </button>`).join('')}
          </div>
        </section>`;
    }

    function menteeActionItems(tasks, meta) {
      const items = [];
      const today = todayIsoLocal();
      const prob = meta && meta.probation;
      if (prob && prob.selfReviewEnabled) {
        (prob.milestones || []).forEach(ms => {
          if (ms.status === 'done' && ms.taskId && !ms.selfSubmitted) {
            items.push({ icon: 'rate_review', title: `ประเมินตนเอง รอบ ${ms.day} วัน`, sub: 'หัวหน้างานประเมินรอบนี้แล้ว — ให้คะแนนตัวเองได้', attr: `data-self-review="${escapeHtml(ms.taskId)}"`, urgent: true });
          }
        });
      }
      (tasks || []).filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < today)
        .forEach(t => items.push({ icon: 'assignment_late', title: t.title || t.taskType, sub: `เลยกำหนด ${formatThaiDate(t.dueDate)}`, attr: `data-ptask="${escapeHtml(t.taskId)}"`, urgent: true }));
      return items;
    }

    function mentorActionItems(tasks) {
      const today = todayIsoLocal();
      return (tasks || []).filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < today)
        .map(t => ({ icon: 'assignment_late', title: t.title || t.taskType, sub: `${escapeHtml(t.taskType)} · เลยกำหนด ${formatThaiDate(t.dueDate)}`, attr: `data-ptask="${escapeHtml(t.taskId)}"`, urgent: true }));
    }

    function hrActionItems(data) {
      const items = [];
      const today = todayIsoLocal();
      buildProbationRows(data).forEach(row => {
        // already passed (incl. HR override, which has no supervisor) → no action needed
        if (row.kase && (row.kase.result === 'pass' || row.kase.status === 'passed')) return;
        if (!row.kase || !row.kase.supervisorUserId) {
          items.push({ icon: 'person_alert', title: `มอบหมายผู้ประเมิน: ${row.emp.employeeName}`, sub: 'ทดลองงานยังไม่มีหัวหน้าประเมิน', attr: `data-ac-prob="${escapeHtml(row.emp.employeeId)}"`, urgent: true });
          return;
        }
        const cur = row.milestones.find(ms => ms.state === 'current' && ms.task);
        if (cur && cur.task && cur.task.dueDate && cur.task.dueDate < today) {
          items.push({ icon: 'assignment_late', title: `ประเมิน ${row.emp.employeeName} รอบ ${cur.day} วัน`, sub: `เลยกำหนด ${formatThaiDate(cur.task.dueDate)}`, attr: `data-ac-prob="${escapeHtml(row.emp.employeeId)}"`, urgent: true });
        }
      });
      return items.slice(0, 6);
    }

    const PORTAL_TASK_META = {
      Feedback: ['rate_review', 'ให้ Feedback'],
      Reflection: ['edit_note', 'ส่ง Reflection'],
      Attendance: ['event_available', 'ยืนยันเข้าร่วม'],
      Probation: ['verified', 'ทำแบบประเมิน']
    };

    function m3PortalNav(role, active) {
      const items = role === 'Mentor'
        ? [['home', 'home', 'หน้าหลัก'], ['mentees', 'groups', 'ทีม'], ['tasks', 'assignment', 'งาน'], ['profile', 'account_circle', 'โปรไฟล์']]
        : [['home', 'home', 'หน้าหลัก'], ['journey', 'map', 'เส้นทาง'], ['tasks', 'assignment', 'งาน'], ['profile', 'account_circle', 'โปรไฟล์']];
      return `<nav class="m3-bottomnav">${items.map(([key, icon, label]) =>
        `<button type="button" class="m3-nav-item ${active === key ? 'active' : ''}" data-ptab="${key}">${micon(icon)}<span>${escapeHtml(label)}</span></button>`).join('')}</nav>`;
    }

    function portalProgress(meta, tasks) {
      if (meta && meta.progress) return meta.progress;
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'Completed').length;
      return { total, completed, pending: total - completed, percent: total ? Math.round((completed / total) * 100) : 100 };
    }

    function m3TaskCard(task) {
      const done = task.status === 'Completed';
      const m = PORTAL_TASK_META[task.taskType] || ['assignment', 'เปิดงาน'];
      return `
        <button type="button" class="m3-task-btn m3-pressable" data-ptask="${escapeHtml(task.taskId)}">
          <div style="display:flex;gap:12px;align-items:flex-start">
            <div class="m3-list-icon">${micon(m[0])}</div>
            <div style="flex:1;min-width:0">
              <div class="m3-staff-name">${escapeHtml(task.title || task.taskType)}</div>
              <div class="m3-list-sub">${escapeHtml(task.taskType)} · ครบกำหนด ${formatThaiDate(task.dueDate)}</div>
            </div>
            <span class="m3-badge ${done ? 'm3-badge--ok' : 'm3-badge--warn'}">${done ? 'เสร็จ' : 'รอทำ'}</span>
          </div>
        </button>`;
    }

    // Employee's own probation status card (no scores — status + rounds + evaluator).
    function probationStatusCard(prob) {
      if (!prob) return '';
      const passed = prob.result === 'pass' || prob.status === 'passed';
      const badge = passed
        ? '<span class="m3-badge m3-badge--ok">ผ่านทดลองงาน</span>'
        : '<span class="m3-badge m3-badge--warn">กำลังทดลองงาน</span>';
      const rows = (prob.milestones || []).map(ms => {
        const chip = ms.status === 'done'
          ? '<span class="m3-badge m3-badge--ok">ประเมินแล้ว</span>'
          : (ms.status === 'current' ? '<span class="m3-badge m3-badge--warn">รอประเมิน</span>' : '<span class="m3-badge">ยังไม่ถึงรอบ</span>');
        // Self-review unlocks only after the boss closes the round; display-only, in-app only.
        const canSelf = prob.selfReviewEnabled && ms.status === 'done' && ms.taskId;
        const selfLine = !canSelf ? '' : (ms.selfSubmitted
          ? `<div style="padding:0 0 9px"><span class="m3-badge m3-badge--ok">${micon('how_to_reg')}ประเมินตนเองแล้ว</span></div>`
          : `<div style="padding:0 0 10px"><button type="button" class="m3-btn m3-btn--tonal" data-self-review="${escapeHtml(ms.taskId)}" style="min-height:40px">${micon('rate_review')}ประเมินตนเอง (รอบ ${ms.day})</button></div>`);
        return `<div style="border-top:1px solid var(--m3-outline-variant)">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0">
            <div><div class="m3-staff-name" style="font-size:14px">รอบ ${ms.day} วัน${ms.extended ? ' · ขยายเวลา' : ''}</div><div class="m3-staff-role">ครบกำหนด ${ms.dueDate ? formatThaiDate(ms.dueDate) : '-'}</div></div>
            ${chip}
          </div>
          ${selfLine}
        </div>`;
      }).join('');
      return `
        <section class="m3-section">
          <div class="m3-card m3-card-pad">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 class="m3-section-label" style="margin:0">สถานะการทดลองงาน</h3>${badge}</div>
            <div class="m3-staff-role" style="margin-bottom:2px">${prob.evaluatorName ? `ผู้ประเมิน: <strong>${escapeHtml(prob.evaluatorName)}</strong>` : 'ยังไม่กำหนดผู้ประเมิน'}${prob.startDate ? ` · เริ่มงาน ${formatThaiDate(prob.startDate)}` : ''}</div>
            ${rows || '<div class="m3-empty">ยังไม่มีรอบประเมิน</div>'}
            <p class="m3-save-hint" style="text-align:left;margin-top:10px">${passed ? 'ผ่านการทดลองงานเรียบร้อยแล้ว 🎉' : 'อยู่ระหว่างทดลองงาน — รอผลการประเมินจากหัวหน้างาน'}</p>
          </div>
        </section>`;
    }

    // Prominent KPI quick-access card on the home screen (buttons reuse the data-attrs wired in renderUserPortal).
    function kpiQuickCard() {
      return `<section class="m3-section"><div class="m3-card m3-card-pad" style="background:linear-gradient(135deg,#eef6f1,#dfeee6);border-color:var(--m3-primary)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><div class="m3-list-icon" style="background:var(--m3-primary);color:#fff">${micon('leaderboard')}</div><div><div class="m3-staff-name">ระบบ KPI</div><div class="m3-staff-role">กรอกผล · ดูคะแนน · เส้นทางรายเดือน</div></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="m3-btn m3-btn--tonal" data-kpi-mine style="flex:1;min-width:130px">${micon('checklist')}KPI ของฉัน</button>
          <button type="button" class="m3-btn m3-btn--ghost" data-kpi-dept style="flex:1;min-width:130px">${micon('groups')}KPI ฝ่าย (หัวหน้า)</button>
        </div>
      </div></section>`;
    }

    function menteeHomeTab(user, tasks, meta) {
      const prog = portalProgress(meta, tasks);
      const pending = tasks.filter(t => t.status !== 'Completed');
      const mentor = meta.mentor;
      const nextSession = tasks.filter(t => t.sessionDate).sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)))[0];
      return `
        <section class="m3-hero"><div class="eb">เส้นทางพนักงานใหม่</div><h2>สวัสดี, ${escapeHtml(user.name || user.displayName || '')}</h2><p>ดูงานที่ต้องทำและความคืบหน้าของคุณ</p></section>
        ${actionCenterCard(menteeActionItems(tasks, meta))}
        ${kpiQuickCard()}
        <section class="m3-prog-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px"><div><div class="m3-progress-cap">ความคืบหน้า</div><div class="m3-prog-big">${prog.percent}%</div></div><div class="m3-staff-role">${prog.completed}/${prog.total} งาน</div></div>
          <div class="m3-progress"><div class="m3-progress-bar" style="width:${prog.percent}%"></div></div>
        </section>
        ${probationStatusCard(meta.probation)}
        ${nextSession ? `
        <section class="m3-section"><h3 class="m3-section-label">เซสชันที่จะถึง</h3>
          <div class="m3-session"><div class="m3-date-block"><span class="m3-date-day">${dateDayMonth(nextSession.sessionDate).day}</span><span class="m3-date-mon">${dateDayMonth(nextSession.sessionDate).mon}</span></div>
          <div class="m3-session-body"><p class="m3-session-title">${escapeHtml(nextSession.title || 'เซสชัน')}</p><div class="m3-session-meta"><span>${micon('schedule')}${escapeHtml(nextSession.startTime || '-')}</span>${nextSession.room ? `<span>${micon('location_on')}${escapeHtml(nextSession.room)}</span>` : ''}</div></div></div>
        </section>` : ''}
        <section class="m3-section"><div class="m3-section-head"><h3 class="m3-section-label">งานที่ต้องทำ</h3><a class="m3-link" data-ptab="tasks">ดูทั้งหมด</a></div>
          ${pending.length ? pending.slice(0, 3).map(m3TaskCard).join('') : '<div class="m3-empty">ไม่มีงานค้าง 🎉</div>'}
        </section>
        <section class="m3-section"><h3 class="m3-section-label">Mentor ของคุณ</h3>
          <div class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:12px"><div class="m3-list-icon">${micon('person_pin')}</div><div><div class="m3-staff-name">${escapeHtml(mentor && mentor.name ? mentor.name : 'ยังไม่กำหนด')}</div><div class="m3-staff-role">${escapeHtml((mentor && mentor.department) || 'Mentor ประจำรอบ')}</div></div></div>
        </section>`;
    }

    function mentorHomeTab(user, tasks, meta) {
      const mentees = meta.mentees || [];
      const pendingFeedback = tasks.filter(t => t.taskType === 'Feedback' && t.status !== 'Completed');
      return `
        <section class="m3-hero"><div class="eb">Mentor</div><h2>สวัสดี, ${escapeHtml(user.name || user.displayName || '')}</h2><p>ดูแลน้องและให้ Feedback ได้ในที่เดียว</p></section>
        ${actionCenterCard(mentorActionItems(tasks))}
        ${kpiQuickCard()}
        <section class="m3-bento">
          <div class="m3-bento-card"><div>${micon('groups')}<p class="m3-bento-label">Mentee</p></div><p class="m3-bento-num">${mentees.length} <small>คน</small></p></div>
          <div class="m3-bento-card"><div>${micon('rate_review')}<p class="m3-bento-label">รอ Feedback</p></div><p class="m3-bento-num">${pendingFeedback.length} <small>งาน</small></p></div>
        </section>
        <section class="m3-section"><div class="m3-section-head"><h3 class="m3-section-label">งาน Feedback ที่รออยู่</h3><a class="m3-link" data-ptab="tasks">ดูทั้งหมด</a></div>
          ${pendingFeedback.length ? pendingFeedback.slice(0, 3).map(m3TaskCard).join('') : '<div class="m3-empty">ไม่มีงาน Feedback ค้าง</div>'}
        </section>
        <section class="m3-section"><div class="m3-section-head"><h3 class="m3-section-label">ทีมที่ดูแล</h3><a class="m3-link" data-ptab="mentees">ดูทั้งหมด</a></div>
          ${mentees.length ? mentees.slice(0, 3).map(menteeMiniCard).join('') : '<div class="m3-empty">ยังไม่มี mentee ที่ได้รับมอบหมาย</div>'}
        </section>`;
    }

    function menteeMiniCard(mentee) {
      return `
        <div class="m3-staff" style="box-shadow:none">
          <div class="m3-staff-head" style="margin-bottom:10px">
            <div class="m3-staff-id"><div class="m3-avatar">${escapeHtml(initials(mentee.name))}</div><div><div class="m3-staff-name">${escapeHtml(mentee.name)}</div><div class="m3-staff-role">${escapeHtml(mentee.department || '-')} · ${escapeHtml(mentee.position || '-')}</div></div></div>
            <span class="m3-badge ${mentee.pendingFeedback ? 'm3-badge--warn' : 'm3-badge--ok'}">M${escapeHtml(mentee.currentMonth || 1)}</span>
          </div>
          <div class="m3-progress-head"><span class="m3-progress-cap">ความคืบหน้า</span><span class="m3-progress-pct">${mentee.progressPercent || 0}%</span></div>
          <div class="m3-progress"><div class="m3-progress-bar" style="width:${mentee.progressPercent || 0}%"></div></div>
        </div>`;
    }

    function menteeJourneyTab(tasks) {
      const months = groupedMonthStats(tasks);
      return `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">เส้นทาง Onboarding</h2></section>
        <div class="m3-timeline m3-stagger">
          ${months.map(item => `
            <div class="m3-tl-item">
              <div class="m3-tl-dot ${item.percent === 100 ? 'done' : (item.percent > 0 ? 'active' : '')}">${item.percent === 100 ? micon('check') : ''}</div>
              <div class="m3-tl-card ${item.percent > 0 && item.percent < 100 ? 'active' : ''}">
                <div><div class="m3-tl-title">เดือน ${item.month}</div><div class="m3-tl-sub">${item.done}/${item.total || 0} งานเสร็จ</div></div>
                <span class="m3-badge ${item.percent === 100 ? 'm3-badge--ok' : 'm3-badge--warn'}">${item.percent}%</span>
              </div>
            </div>`).join('')}
        </div>`;
    }

    function portalTasksTab(tasks, role) {
      return `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">${role === 'Mentor' ? 'งานของฉัน' : 'งานที่ต้องทำ'}</h2></section>
        <section class="m3-section m3-stagger">${tasks.length ? tasks.map(m3TaskCard).join('') : '<div class="m3-empty">ยังไม่มีงาน</div>'}</section>`;
    }

    function mentorMenteesTab(meta) {
      const mentees = meta.mentees || [];
      return `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">ทีมที่ดูแล</h2></section>
        <section class="m3-section m3-stagger">${mentees.length ? mentees.map(menteeMiniCard).join('') : '<div class="m3-empty">ยังไม่มี mentee ที่ได้รับมอบหมาย</div>'}</section>`;
    }

    function portalProfileTab(user, meta, role) {
      const mentor = meta.mentor;
      const group = meta.onboardingGroup;
      return `
        <section class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:16px"><div class="m3-avatar m3-avatar--lg">${escapeHtml(initials(user.name || user.displayName))}</div><div><h2 class="m3-headline">${escapeHtml(user.name || user.displayName || '')}</h2><p class="m3-staff-role">${escapeHtml(role)} · ${escapeHtml(user.department || '-')}</p></div></section>
        <section class="m3-section"><h3 class="m3-section-label">ข้อมูล</h3>
          <div class="m3-card m3-card-pad">
            <div class="m3-att-row"><span class="t">ตำแหน่ง</span><strong>${escapeHtml(user.position || '-')}</strong></div>
            <div class="m3-att-row"><span class="t">อีเมล</span><strong>${escapeHtml(user.email || '-')}</strong></div>
            ${role === 'Mentee' && mentor ? `<div class="m3-att-row"><span class="t">Mentor</span><strong>${escapeHtml(mentor.name || '-')}</strong></div>` : ''}
            ${role === 'Mentee' && group ? `<div class="m3-att-row"><span class="t">กลุ่ม</span><strong>${escapeHtml(group.groupName || '-')}</strong></div>` : ''}
          </div>
        </section>
        <section class="m3-section" style="gap:8px">
          <button type="button" class="m3-btn m3-btn--tonal" data-kpi-mine>${micon('checklist')}KPI ของฉัน (กรอกผล)</button>
          <button type="button" class="m3-btn m3-btn--tonal" data-kpi-dept>${micon('leaderboard')}KPI ฝ่ายของฉัน (หัวหน้าฝ่าย)</button>
        </section>
        ${webSessionToken && !isLineBrowser() ? `<section class="m3-section"><button type="button" class="m3-btn m3-btn--outline" data-portal-logout>${micon('logout')}ออกจากระบบ</button></section>` : ''}`;
    }

    function renderUserPortal(user, tasks, options = {}) {
      currentUser = user;
      currentTasks = tasks || [];
      currentPortalMeta = options.meta || currentPortalMeta || {};
      portalPreviewMode = Boolean(options.preview);
      const meta = currentPortalMeta;
      const role = user.role === 'Mentor' ? 'Mentor' : 'Mentee';
      if (!['home', 'journey', 'tasks', 'profile', 'mentees'].includes(portalTab)) portalTab = 'home';

      let inner;
      if (portalTab === 'journey') inner = menteeJourneyTab(tasks);
      else if (portalTab === 'tasks') inner = portalTasksTab(tasks, role);
      else if (portalTab === 'mentees') inner = mentorMenteesTab(meta);
      else if (portalTab === 'profile') inner = portalProfileTab(user, meta, role);
      else inner = role === 'Mentor' ? mentorHomeTab(user, tasks, meta) : menteeHomeTab(user, tasks, meta);

      const banner = options.preview
        ? `<div class="m3-assign-card" style="background:var(--m3-warn-bg);border-color:var(--m3-warn-fg)"><div class="cap" style="color:var(--m3-warn-fg)">โหมด Preview (${escapeHtml(role)}) · <button type="button" data-back-admin style="background:none;border:0;color:var(--m3-warn-fg);text-decoration:underline;font-weight:700;font-family:inherit">กลับ Admin</button></div></div>`
        : '';

      render(`<div class="m3-app m3-fade-up">${m3TopBar({ title: 'Nose Tea' })}<main class="m3-main m3-stagger">${banner}${inner}</main>${m3PortalNav(role, portalTab)}</div>`);

      document.querySelectorAll('[data-ptab]').forEach(b => b.addEventListener('click', () => { portalTab = b.dataset.ptab; renderUserPortal(user, tasks, options); }));
      document.querySelectorAll('[data-ptask]').forEach(b => b.addEventListener('click', () => {
        const task = tasks.find(t => t.taskId === b.dataset.ptask);
        if (!task) return;
        if (task.taskType === 'Probation' && !options.preview) {
          openProbationEval(task.taskId, async () => { const p = await api('/getPortal'); renderUserPortal(p.user, p.tasks || [], { meta: p }); });
          return;
        }
        renderM3TaskForm(user, task, options);
      }));
      document.querySelectorAll('[data-self-review]').forEach(b => b.addEventListener('click', () => renderProbationSelfForm(b.dataset.selfReview)));
      const ba = document.querySelector('[data-back-admin]');
      if (ba) ba.addEventListener('click', renderHrHome);
      const bell = document.querySelector('[data-m3-action="notifications"]');
      if (bell) bell.addEventListener('click', () => renderNotifications());
      const plo = document.querySelector('[data-portal-logout]');
      if (plo) plo.addEventListener('click', logoutWebAdmin);
      const kd = document.querySelector('[data-kpi-dept]');
      if (kd) kd.addEventListener('click', () => { window.KPI && window.KPI.renderDeptHome ? window.KPI.renderDeptHome() : toast('โมดูล KPI ยังไม่พร้อม', 'error'); });
      const km = document.querySelector('[data-kpi-mine]');
      if (km) km.addEventListener('click', () => { window.KPI && window.KPI.renderMyKpi ? window.KPI.renderMyKpi() : toast('โมดูล KPI ยังไม่พร้อม', 'error'); });
    }

    // Faint caption per score level. Maps any N-point scale (by rank) to a 5-band label set,
    // so it degrades gracefully for non-5 scales. Captions are display-only — the stored
    // numeric value is unchanged, so CSV/PDF export is unaffected.
    function scaleCaption(kind, fraction) {
      const agree = ['ไม่เห็นด้วยอย่างยิ่ง', 'ไม่เห็นด้วย', 'ปานกลาง', 'เห็นด้วย', 'เห็นด้วยอย่างยิ่ง'];
      const perf = ['ต้องปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก', 'ดีเยี่ยม'];
      const set = kind === 'perf' ? perf : agree;
      const f = Math.max(0, Math.min(1, fraction));
      const band = f < 0.125 ? 0 : f < 0.375 ? 1 : f < 0.625 ? 2 : f < 0.875 ? 3 : 4;
      return set[band];
    }

    // Default caption mapped to the NUMERIC value (highest value = best caption), so it stays
    // correct no matter the order points are typed (4,3,2,1 vs 1,2,3,4). The stored score is the
    // number itself — higher number always = higher score — so the caption must follow the number.
    function defaultCaptionFor(kind, value, points) {
      const nums = (points || []).map(Number).filter(x => !Number.isNaN(x));
      if (nums.length < 2) return '';
      const min = Math.min(...nums), max = Math.max(...nums);
      return scaleCaption(kind, max === min ? 1 : (Number(value) - min) / (max - min));
    }

    // Segmented score buttons with a number + faint caption. Used by Feedback (perf) and
    // probation Competency (agree). Radio-based so the active state is pure CSS (:has).
    // `labels` (optional, aligned to points) overrides the auto caption per level when set.
    function m3ScaleButtons(name, points, current, kind, labels) {
      const list = points || [];
      const n = list.length;
      return `<div class="m3-scalegrid" style="grid-template-columns:repeat(${n || 1},1fr)">${list.map((v, i) => {
        const custom = labels && labels[i] != null && String(labels[i]).trim();
        const cap = custom ? labels[i] : defaultCaptionFor(kind, v, list);
        return `<label class="m3-scorebtn m3-scorebtn--cap">
          <input type="radio" name="${name}" value="${v}" ${String(current) === String(v) ? 'checked' : ''}>
          <span class="num">${v}</span>
          <span class="cap">${escapeHtml(cap)}</span>
        </label>`;
      }).join('')}</div>`;
    }

    function m3ScoreGroup(name, label, current) {
      return `<div style="margin-bottom:14px"><div class="m3-elabel">${escapeHtml(label)}</div>${m3ScaleButtons(name, [2, 4, 6, 8, 10], current, 'perf', obFeedbackLabels)}</div>`;
    }

    function renderM3TaskForm(user, task, options = {}) {
      const isPreview = Boolean(options.preview);
      const disabled = task.status === 'Completed';
      const localKey = `noseTeaDraft:${task.taskId}`;
      let draft = task.submission || {};
      try { const raw = localStorage.getItem(localKey); if (raw) { const d = JSON.parse(raw); if (d && d.submission) draft = d.submission; } } catch (e) {}

      let fields = '';
      if (task.taskType === 'Feedback') {
        fields = `
          ${m3ScoreGroup('understanding', 'ความเข้าใจในงาน', draft.understanding)}
          ${m3ScoreGroup('participation', 'การมีส่วนร่วม', draft.participation)}
          ${m3ScoreGroup('communication', 'การสื่อสาร', draft.communication)}
          ${m3ScoreGroup('adaptability', 'การปรับตัว', draft.adaptability)}
          ${m3ScoreGroup('responsibility', 'ความรับผิดชอบ', draft.responsibility)}
          <div class="m3-elabel">ข้อเสนอแนะเพิ่มเติม</div>
          <textarea class="m3-textarea" name="comment" placeholder="สิ่งที่ทำได้ดี / จุดที่อยากให้เสริม">${escapeHtml(draft.comment || '')}</textarea>`;
      } else if (task.taskType === 'Reflection') {
        fields = `
          <div class="m3-elabel">3 สิ่งที่ได้เรียนรู้</div><textarea class="m3-textarea" name="learnings" required>${escapeHtml(draft.learnings || '')}</textarea>
          <div class="m3-elabel">2 เรื่องที่ยังท้าทาย</div><textarea class="m3-textarea" name="challenges" required>${escapeHtml(draft.challenges || '')}</textarea>
          <div class="m3-elabel">1 ข้อเสนอแนะ</div><textarea class="m3-textarea" name="suggestion" required>${escapeHtml(draft.suggestion || '')}</textarea>
          <div class="m3-elabel">อยากให้ทีมช่วยอะไรเพิ่มเติม</div><textarea class="m3-textarea" name="support">${escapeHtml(draft.support || '')}</textarea>`;
      } else {
        fields = `
          <div class="m3-card m3-card-pad">
            <div class="m3-att-row"><span class="t">วันที่</span><strong>${formatThaiDate(task.sessionDate || task.dueDate)}</strong></div>
            <div class="m3-att-row"><span class="t">เวลา</span><strong>${escapeHtml(task.startTime || '-')} - ${escapeHtml(task.endTime || '-')}</strong></div>
            <div class="m3-att-row"><span class="t">ห้อง</span><strong>${escapeHtml(task.room || '-')}</strong></div>
          </div>
          <input type="hidden" name="confirmed" value="yes">`;
      }

      const body = `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">${escapeHtml(task.title || 'งานของคุณ')}</h2><p class="m3-eyebrow">${escapeHtml(task.taskType)} · ครบกำหนด ${formatThaiDate(task.dueDate)}</p></section>
        <form id="m3TaskForm" class="m3-section">${fields}</form>
        ${task.taskType !== 'Attendance' ? '<p class="m3-save-hint" id="m3TaskHint" style="margin-top:6px">ระบบบันทึกร่างอัตโนมัติ</p>' : ''}
        <section class="m3-section" style="gap:10px">
          <button type="button" class="m3-btn" id="m3TaskSubmit" ${disabled ? 'disabled' : ''}>${micon('check_circle')}${disabled ? 'ส่งแล้ว' : 'ส่งข้อมูล'}</button>
        </section>
        <div style="height:30px"></div>`;
      render(m3Shell('tasks', body, { bar: { title: 'งานของคุณ', back: true } }));

      const back = () => renderUserPortal(user, currentTasks, options);
      // override nav: portal nav not shown here (m3Shell renders HR nav). Hide it for task form.
      const navEl = document.querySelector('.m3-bottomnav');
      if (navEl) navEl.remove();
      const backBtn = document.querySelector('[data-m3-back]');
      if (backBtn) backBtn.addEventListener('click', back);

      const form = document.getElementById('m3TaskForm');
      const collect = () => Object.fromEntries(new FormData(form).entries());
      const hint = document.getElementById('m3TaskHint');
      let timer = null;
      if (task.taskType !== 'Attendance' && !disabled) {
        form.addEventListener('input', () => {
          const submission = collect();
          try { localStorage.setItem(localKey, JSON.stringify({ submission, savedAt: Date.now() })); } catch (e) {}
          if (hint) { hint.textContent = 'บันทึกร่างในเครื่องแล้ว'; hint.classList.add('saved'); }
          if (!isPreview) {
            clearTimeout(timer);
            timer = setTimeout(() => api('/saveTaskDraft', { taskId: task.taskId, submission }).then(() => { if (hint) hint.textContent = 'บันทึกร่างขึ้นระบบแล้ว · ข้อมูลไม่หาย'; }).catch(() => {}), 1500);
          }
        });
      }

      document.getElementById('m3TaskSubmit').addEventListener('click', async () => {
        if (isPreview) { toast('โหมด Preview: ฟอร์มนี้ยังไม่บันทึกจริง', 'info'); return; }
        const submission = collect();
        if (task.taskType === 'Reflection' && (!submission.learnings || !submission.challenges || !submission.suggestion)) { toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
        if (task.taskType === 'Feedback' && ['understanding', 'participation', 'communication', 'adaptability', 'responsibility'].some(k => !submission[k])) { toast('กรุณาให้คะแนนครบทุกข้อ', 'error'); return; }
        const restore = busyButton(document.getElementById('m3TaskSubmit'), 'กำลังส่ง...');
        try {
          await api('/submitTask', { taskId: task.taskId, submission });
          try { localStorage.removeItem(localKey); } catch (e) {}
          const portal = await api('/getPortal');
          toast('ส่งงานเรียบร้อย');
          renderUserPortal(portal.user, portal.tasks || [], { meta: portal });
        } catch (e) { restore(); toast(e.message, 'error'); }
      });
    }

    // Employee self-review of a probation round (display-only). Opens after the boss closes the round.
    // Shows the boss's factual attendance (read-only, so the employee isn't confused about their own
    // late/leave counts) and lets them self-rate the KPI + competency items — never sees boss scores.
    async function renderProbationSelfForm(taskId) {
      render(m3Loading('ประเมินตนเอง'));
      let data;
      try { data = await api('/getProbationSelfForm', { taskId }); }
      catch (e) { toast(e.message, 'error'); renderUserPortal(currentUser, currentTasks, { meta: currentPortalMeta }); return; }

      const attMarkup = (data.attendance || []).map(sec => `
        <section class="m3-card m3-card-pad">
          <h3 class="m3-section-label" style="margin-bottom:8px">${escapeHtml(sec.title)} · ข้อมูลจากหัวหน้างาน</h3>
          ${(sec.rows || []).map(r => `<div class="m3-att-row"><span class="t">${escapeHtml(r.label)}</span><strong>${Math.round(r.count)}</strong></div>`).join('')}
          <p class="m3-save-hint" style="text-align:left;margin:8px 0 0">ตัวเลขจริงที่หัวหน้างานบันทึกไว้ (ดูอย่างเดียว)</p>
        </section>`).join('');

      const scoredMarkup = (data.scored || []).map(sec => `
        <section class="m3-card m3-card-pad" data-self-sec="${sec.idx}">
          <h3 class="m3-section-label" style="margin-bottom:10px">${escapeHtml(sec.title)} — ให้คะแนนตนเอง</h3>
          ${(sec.items || []).map((item, i) => `
            <div class="m3-eval-item m3-eval-item--col">
              <div class="t">${i + 1}. ${escapeHtml(item.label)}</div>
              ${m3ScaleButtons(`self-${sec.idx}-${i}`, (sec.scale && sec.scale.points) || [], ((data.answers || {})[sec.idx] || [])[i], sec.type === 'kpi' ? 'perf' : 'agree', sec.scale && sec.scale.labels)}
            </div>`).join('')}
        </section>`).join('');

      const submitted = Boolean(data.submitted);
      const body = `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">ประเมินตนเอง · รอบ ${data.day} วัน</h2><p class="m3-eyebrow">ให้คะแนนตัวเองตามความเป็นจริงได้เลย — เป็นมุมมองของคุณไว้พูดคุยกับหัวหน้างานและ HR และไม่มีผลต่อการผ่านทดลองงาน</p></section>
        ${attMarkup}
        ${scoredMarkup || '<div class="m3-empty">แบบฟอร์มนี้ไม่มีหัวข้อให้ประเมินตนเอง</div>'}
        ${submitted
          ? '<p class="m3-save-hint" style="text-align:center">คุณส่งการประเมินตนเองรอบนี้เรียบร้อยแล้ว ขอบคุณค่ะ</p>'
          : (scoredMarkup ? `<section class="m3-section"><button type="button" class="m3-btn" id="selfSubmit">${micon('check_circle')}ส่งการประเมินตนเอง</button></section>` : '')}
        <div style="height:30px"></div>`;
      render(m3Shell('home', body, { bar: { title: 'ประเมินตนเอง', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderUserPortal(currentUser, currentTasks, { meta: currentPortalMeta }) });

      const submit = document.getElementById('selfSubmit');
      if (submit) submit.addEventListener('click', async () => {
        const scores = {};
        let missing = false;
        (data.scored || []).forEach(sec => {
          scores[sec.idx] = (sec.items || []).map((item, i) => {
            const el = document.querySelector(`input[name="self-${sec.idx}-${i}"]:checked`);
            if (!el) missing = true;
            return el ? Number(el.value) : null;
          });
        });
        if (missing) { toast('กรุณาให้คะแนนให้ครบทุกข้อก่อนส่ง', 'error'); return; }
        const restore = busyButton(submit, 'กำลังส่ง...');
        try {
          await api('/submitProbationSelfReview', { taskId, submission: { scores } });
          toast('ส่งการประเมินตนเองเรียบร้อยแล้ว');
          const p = await api('/getPortal');
          renderUserPortal(p.user, p.tasks || [], { meta: p });
        } catch (e) { restore(); toast(e.message, 'error'); }
      });
    }

    function renderHrProfile() {
      const user = currentUser || {};
      const body = `
        <section class="m3-section" style="gap:16px">
          <div class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:16px">
            <div class="m3-list-icon" style="width:56px;height:56px">${micon('account_circle')}</div>
            <div>
              <h2 class="m3-headline">${escapeHtml(user.name || user.displayName || 'HR Admin')}</h2>
              <p class="m3-list-sub">${escapeHtml(user.role || 'HR')} · ${escapeHtml(user.department || '-')}</p>
            </div>
          </div>
          <button type="button" class="m3-btn" data-m3-manage>${micon('settings')}จัดการระบบ</button>
          ${webSessionToken && !isLineBrowser() ? '<button type="button" class="m3-btn m3-btn--outline" data-m3-logout>ออกจากระบบ</button>' : ''}
        </section>
        <section class="m3-section">
          <h3 class="m3-section-label">เครื่องมือทดสอบ / ดูตัวอย่าง</h3>
          <div class="m3-card m3-card-pad" style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:10px">
              <button type="button" class="m3-btn m3-btn--ghost" data-prev="Mentor" style="flex:1">ดูมุม Mentor</button>
              <button type="button" class="m3-btn m3-btn--ghost" data-prev="Mentee" style="flex:1">ดูมุม Mentee</button>
            </div>
            <button type="button" class="m3-btn m3-btn--ghost" data-prev-exec>${micon('insights')}ดูมุม Executive</button>
            <button type="button" class="m3-btn m3-btn--ghost" data-health>${micon('monitor_heart')}ตรวจสถานะ API</button>
            <p class="m3-save-hint" id="profHealth" style="text-align:left"></p>
          </div>
        </section>
      `;
      render(m3Shell('profile', body, { bar: { title: 'โปรไฟล์' } }));
      wireM3Nav();
      const manage = document.querySelector('[data-m3-manage]');
      if (manage) manage.addEventListener('click', () => renderManageHub());
      const logout = document.querySelector('[data-m3-logout]');
      if (logout) logout.addEventListener('click', logoutWebAdmin);
      document.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click', () => previewAs(b.dataset.prev)));
      const prevExec = document.querySelector('[data-prev-exec]');
      if (prevExec) prevExec.addEventListener('click', () => renderExecHome({ preview: true }));
      const health = document.querySelector('[data-health]');
      if (health) health.addEventListener('click', async () => {
        const out = document.getElementById('profHealth');
        out.textContent = 'กำลังตรวจสอบ...';
        try { const r = await fetch(`${API_BASE}/health`); const t = await r.text(); out.textContent = `API ปกติ: ${t}`; }
        catch (e) { out.textContent = `เชื่อมต่อ API ไม่ได้: ${e.message}`; }
      });
    }

    /* ===================================================================
       HR MANAGEMENT (M3) — classic admin removed (Stage 2 complete)
       =================================================================== */

    function renderManageHub() {
      const items = [
        ['master', 'badge', 'Master Data พนักงาน', 'นำเข้า/แก้ไขข้อมูลพนักงาน', true],
        ['users', 'manage_accounts', 'ผู้ใช้และสิทธิ์', 'แก้ Role, แผนก, การผูก LINE', true],
        ['groups', 'group_work', 'กลุ่ม Onboarding', 'สร้างกลุ่ม + มอบหมาย mentor/mentee', true],
        ['sessions', 'event', 'Session / รอบงาน', 'สร้างและจัดการเซสชัน', true],
        ['messages', 'forum', 'ส่งข้อความ LINE', 'ส่งรายคน/กลุ่ม + automation', true],
        ['templates', 'description', 'คลังข้อความ', 'Template ข้อความ LINE', true],
        ['fbscale', 'tune', 'คำอธิบายคะแนน Feedback', 'แก้คำกำกับปุ่มให้คะแนน OB', true],
        ['kpi', 'trending_up', 'ระบบ KPI', 'ตั้ง/แจก/ประเมิน KPI (กำลังพัฒนา)', true],
        ['fb360', 'groups', '360° Feedback', 'รอบประเมิน 360 องศา (กำลังพัฒนา)', true],
        ['audit', 'history', 'ประวัติการแก้ไข (Audit)', 'เฉพาะเจ้าของระบบ', true],
        ['backup', 'cloud_download', 'สำรองข้อมูล (Backup)', 'ดาวน์โหลดข้อมูลทั้งระบบเก็บไว้บนเครื่อง', true]
      ].filter(it => !['audit', 'backup'].includes(it[0]) || (adminCache && adminCache.isOwner));
      const body = `
        <section class="m3-section" style="gap:4px">
          <h2 class="m3-title">จัดการระบบ</h2>
          <p class="m3-eyebrow">ศูนย์รวมเครื่องมือ HR</p>
        </section>
        <section class="m3-section">
          ${items.map(([key, icon, title, sub, ready]) => `
            <button type="button" class="m3-task-btn m3-pressable" data-hub="${key}">
              <div style="display:flex;gap:14px;align-items:center">
                <div class="m3-list-icon">${micon(icon)}</div>
                <div style="flex:1;min-width:0"><div class="m3-staff-name">${escapeHtml(title)}</div><div class="m3-list-sub">${escapeHtml(sub)}</div></div>
                ${ready ? '' : '<span class="m3-badge">เดิม</span>'}
                ${micon('chevron_right')}
              </div>
            </button>
          `).join('')}
        </section>
      `;
      render(m3Shell('profile', body, { bar: { title: 'จัดการระบบ', back: true } }));
      wireM3Nav({ back: () => renderHrProfile() });
      document.querySelectorAll('[data-hub]').forEach(b => b.addEventListener('click', async () => {
        const k = b.dataset.hub;
        if (k === 'master') renderEmployeesM3();
        else if (k === 'users') renderUsersM3();
        else if (k === 'groups') renderGroupsM3();
        else if (k === 'sessions') renderSessionsM3();
        else if (k === 'messages') renderMessagesM3();
        else if (k === 'templates') renderMsgTemplatesM3();
        else if (k === 'fbscale') renderFeedbackScaleEditor();
        else if (k === 'audit') { const d = adminCache || await api('/adminData'); adminCache = d; renderAuditLog(d); }
        else if (k === 'backup') downloadBackup();
        else if (k === 'kpi') { window.KPI ? window.KPI.renderHome() : toast('โมดูล KPI ยังไม่พร้อม', 'error'); }
        else if (k === 'fb360') { window.FB360 ? window.FB360.renderHome() : toast('โมดูล 360 ยังไม่พร้อม', 'error'); }
      }));
    }

    // Owner-only full backup: pull every table as JSON and save it to the user's computer straight from
    // the browser (their IT blocks wrangler/Node). Keep the file as an archive; a dev can restore from it.
    async function downloadBackup() {
      toast('กำลังเตรียมไฟล์สำรองข้อมูล...', 'info');
      try {
        const data = await api('/exportBackup');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nose-tea-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว · เก็บไว้บนเครื่อง/คลาวด์ให้ปลอดภัย');
      } catch (e) { toast(e.message, 'error'); }
    }

    // HR edits the captions under the OB Feedback score buttons (levels 2/4/6/8/10).
    // Display-only — the stored numeric scores + CSV/summary are unaffected.
    function renderFeedbackScaleEditor() {
      const points = [2, 4, 6, 8, 10];
      const defaults = ['ต้องปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก', 'ดีเยี่ยม'];
      const cur = Array.isArray(obFeedbackLabels) ? obFeedbackLabels : [];
      const rows = points.map((p, i) => `
        <div class="m3-eitem">
          <span style="min-width:34px;text-align:center;font-weight:700;color:var(--m3-primary)">${p}</span>
          <input class="m3-input" data-fb-label="${i}" value="${escapeHtml(cur[i] || '')}" placeholder="${escapeHtml(defaults[i])}">
        </div>`).join('');
      const body = `
        <section class="m3-section" style="gap:4px">
          <h2 class="m3-title">คำอธิบายคะแนน Feedback</h2>
          <p class="m3-eyebrow">คำกำกับใต้ปุ่มให้คะแนน (แบบประเมิน Feedback ของ Onboarding · เต็ม 10)</p>
        </section>
        <section class="m3-section">
          <div class="m3-card m3-card-pad">
            ${rows}
            <p class="m3-save-hint" style="text-align:left;margin-top:10px">เว้นว่าง = ใช้คำมาตรฐาน (สีจาง) · คะแนนเต็ม/การคำนวณ/export ไม่เปลี่ยน</p>
          </div>
          <button type="button" class="m3-btn m3-btn--ghost" id="fbScaleDefault" style="margin-top:10px">${micon('auto_fix_high')}เติมคำมาตรฐาน</button>
          <button type="button" class="m3-btn" id="fbScaleSave" style="margin-top:8px">${micon('save')}บันทึก</button>
        </section>
        <div style="height:24px"></div>
      `;
      render(m3Shell('profile', body, { bar: { title: 'คำอธิบายคะแนน Feedback', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderManageHub() });
      document.getElementById('fbScaleDefault').addEventListener('click', () => {
        document.querySelectorAll('[data-fb-label]').forEach((inp, i) => { inp.value = defaults[i] || ''; });
        toast('เติมคำมาตรฐานแล้ว แก้ต่อได้');
      });
      document.getElementById('fbScaleSave').addEventListener('click', async event => {
        const labels = [...document.querySelectorAll('[data-fb-label]')].map(inp => inp.value.trim());
        const restore = busyButton(event.currentTarget, 'กำลังบันทึก...');
        try {
          await api('/saveFeedbackScale', { labels });
          obFeedbackLabels = labels;
          toast('บันทึกแล้ว');
          renderManageHub();
        } catch (e) { restore(); toast(e.message, 'error'); }
      });
    }

    function empCard(e) {
      const search = `${e.employeeName || ''} ${e.employeeCode || ''} ${e.department || ''} ${e.branch || ''}`.toLowerCase();
      const linked = Boolean(e.userId);
      return `
        <div class="m3-staff" data-emp-card="${escapeHtml(e.employeeId)}" data-search="${escapeHtml(search)}">
          <div class="m3-staff-head" style="margin-bottom:10px">
            <div class="m3-staff-id"><div class="m3-avatar">${escapeHtml(initials(e.employeeName))}</div><div><div class="m3-staff-name">${escapeHtml(e.employeeName || '-')}</div><div class="m3-staff-role">${escapeHtml(e.employeeCode || '-')} · ${escapeHtml(e.department || '-')}${e.branch ? ' · ' + escapeHtml(e.branch) : ''}${e.level ? ' · L' + escapeHtml(String(e.level)) : ''}${e.rank ? '/R' + escapeHtml(String(e.rank)) : ''}${e.jobGroup ? ' · ' + escapeHtml(e.jobGroup) : ''}</div></div></div>
            <span class="m3-badge ${linked ? 'm3-badge--ok' : 'm3-badge--warn'}">${linked ? 'ผูก LINE' : 'รอผูก'}</span>
          </div>
          ${linked ? `<div class="m3-list-sub" style="margin:-4px 0 10px;display:flex;align-items:center;gap:5px">${micon('chat')}ผูกกับ LINE: <strong>${escapeHtml(e.linkedDisplayName || '—')}</strong></div>` : ''}
          <div class="m3-tpl-actions">
            <button type="button" class="m3-btn m3-btn--tonal" data-emp-edit="${escapeHtml(e.employeeId)}">${micon('edit')}แก้ไข</button>
            ${linked ? `<button type="button" class="m3-btn m3-btn--ghost" data-emp-unlink="${escapeHtml(e.employeeId)}">ยกเลิกผูก</button>` : ''}
          </div>
        </div>`;
    }

    async function renderEmployeesM3() {
      render(m3Loading('Master Data'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const emps = data.employees || [];
        const body = `
          <section class="m3-section">
            <h2 class="m3-title">พนักงาน (Master Data)</h2>
            <p class="m3-eyebrow">${emps.length} คน · ${emps.filter(e => e.userId).length} ผูก LINE แล้ว</p>
            <div style="display:flex;gap:10px">
              <button type="button" class="m3-btn m3-btn--tonal" data-emp-import>${micon('upload_file')}นำเข้า CSV</button>
              <button type="button" class="m3-btn" data-emp-add>${micon('person_add')}เพิ่ม</button>
            </div>
          </section>
          <div class="m3-stickytop"><div class="m3-search">${micon('search')}<input id="empSearch" placeholder="ค้นหาชื่อ รหัส หรือแผนก"></div></div>
          <section class="m3-section m3-stagger" id="empList">${emps.map(empCard).join('') || m3Empty('badge', 'ยังไม่มีพนักงาน', 'เพิ่มเองหรือ import CSV เพื่อเริ่มต้น')}</section>
        `;
        render(m3Shell('onboarding', body, { bar: { title: 'Master Data', back: true } }));
        wireM3Nav({ back: () => renderManageHub() });
        markHrView(renderEmployeesM3);
        const s = document.getElementById('empSearch');
        s.addEventListener('input', () => { const k = s.value.trim().toLowerCase(); document.querySelectorAll('[data-emp-card]').forEach(c => { c.style.display = !k || c.dataset.search.includes(k) ? '' : 'none'; }); });
        document.querySelector('[data-emp-add]').addEventListener('click', () => renderEmployeeEditorM3(null));
        document.querySelector('[data-emp-import]').addEventListener('click', () => renderEmployeeImportM3());
        document.querySelectorAll('[data-emp-edit]').forEach(b => b.addEventListener('click', () => renderEmployeeEditorM3(emps.find(e => e.employeeId === b.dataset.empEdit))));
        document.querySelectorAll('[data-emp-unlink]').forEach(b => b.addEventListener('click', async () => {
          if (!await confirmSheet({ title: 'ยกเลิกการผูก LINE?', desc: 'พนักงานคนนี้จะหลุดจากบัญชี LINE ที่ผูกไว้ (รหัสว่างให้ผูกใหม่ได้)', confirmLabel: 'ยกเลิกผูก', danger: true })) return;
          try { await api('/adminUnlinkEmployee', { employeeId: b.dataset.empUnlink, reason: 'admin_ui' }); adminCache = null; renderEmployeesM3(); } catch (e) { toast(e.message, 'error'); }
        }));
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    function renderEmployeeEditorM3(emp) {
      const e = emp || {};
      const body = `
        <section class="m3-section">
          <h2 class="m3-title">${e.employeeId ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</h2>
          <form id="empForm">
            <input type="hidden" name="employeeId" value="${escapeHtml(e.employeeId || '')}">
            <label class="m3-elabel">รหัสพนักงาน</label><input class="m3-input" name="employeeCode" required value="${escapeHtml(e.employeeCode || '')}" placeholder="เช่น 6809145">
            <label class="m3-elabel">ชื่อ-นามสกุล</label><input class="m3-input" name="employeeName" required value="${escapeHtml(e.employeeName || '')}">
            <label class="m3-elabel">แผนก</label><input class="m3-input" name="department" value="${escapeHtml(e.department || '')}">
            <label class="m3-elabel">ตำแหน่ง</label><input class="m3-input" name="position" value="${escapeHtml(e.position || '')}">
            <label class="m3-elabel">สาขา</label><input class="m3-input" name="branch" value="${escapeHtml(e.branch || '')}">
            <label class="m3-elabel">Level (1-5 · สำหรับ KPI/360)</label>
            <select class="m3-select" name="level"><option value="">— ยังไม่ระบุ —</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${String(e.level) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select>
            <label class="m3-elabel">Rank (1-17 · เลขน้อย = อาวุโสกว่า)</label>
            <input class="m3-input" type="number" name="rank" min="1" max="17" inputmode="numeric" value="${e.rank != null ? escapeHtml(String(e.rank)) : ''}" placeholder="เช่น 16">
            <label class="m3-elabel">Job Group</label>
            <input class="m3-input" name="jobGroup" value="${escapeHtml(e.jobGroup || '')}" placeholder="เช่น Store, Office">
            <label class="m3-elabel">วันเริ่มงาน (ใช้คำนวณทดลองงาน 30/60/90)</label><input class="m3-input" type="date" name="startDate" value="${escapeHtml(e.startDate || '')}">
            <label class="m3-elabel">สถานะการจ้าง</label>
            <select class="m3-select" name="employmentStatus">${['active', 'probation', 'inactive', 'resigned'].map(s => `<option value="${s}" ${s === (e.employmentStatus || 'active') ? 'selected' : ''}>${s}</option>`).join('')}</select>
            <label class="m3-elabel">ทดลองงาน</label>
            <select class="m3-select" name="probationRequired"><option value="0" ${e.probationRequired ? '' : 'selected'}>ไม่ต้องประเมิน</option><option value="1" ${e.probationRequired ? 'selected' : ''}>ต้องประเมิน</option></select>
            <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}บันทึก</button>
          </form>
          ${e.employeeId ? `
          <div class="m3-section" style="margin-top:18px;gap:6px">
            <div class="m3-section-label" style="color:var(--m3-error)">โซนอันตราย</div>
            <button type="button" class="m3-btn m3-btn--outline" id="empDelete" style="color:var(--m3-error);border-color:var(--m3-error)">${micon('delete_forever')}ลบพนักงานออกถาวร</button>
            <p class="m3-save-hint" style="text-align:left">ลบข้อมูลพนักงาน + ผลประเมินทดลองงาน + งาน onboarding ทั้งหมดของคนนี้ — กู้คืนไม่ได้ (ใช้ล้างข้อมูลทดสอบ)</p>
          </div>` : ''}
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('onboarding', body, { bar: { title: e.employeeId ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderEmployeesM3() });
      wireValidation(document.getElementById('empForm'));
      document.getElementById('empForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!guardRequired(event.currentTarget)) return;
        const restore = busyButton(event.currentTarget.querySelector('button[type=submit]'));
        try {
          await api('/adminUpsertEmployee', Object.fromEntries(new FormData(event.currentTarget).entries()));
          adminCache = null;
          toast('บันทึกพนักงานแล้ว');
          renderEmployeesM3();
        } catch (err) { restore(); toast(err.message, 'error'); }
      });
      const empDel = document.getElementById('empDelete');
      if (empDel) empDel.addEventListener('click', async () => {
        if (!await confirmSheet({ title: `ลบ ${e.employeeName || e.employeeCode}?`, desc: 'ลบข้อมูลพนักงาน + ผลประเมินทดลองงาน + งาน onboarding ทั้งหมด · กู้คืนไม่ได้', confirmLabel: 'ลบถาวร', danger: true })) return;
        const dr = busyButton(empDel, 'กำลังลบ...');
        try { await api('/adminDeleteEmployee', { employeeId: e.employeeId }); adminCache = null; toast('ลบพนักงานแล้ว'); renderEmployeesM3(); } catch (err) { dr(); toast(err.message, 'error'); }
      });
    }

    function renderEmployeeImportM3() {
      const body = `
        <section class="m3-section">
          <h2 class="m3-title">นำเข้าพนักงาน (CSV)</h2>
          <div class="m3-empty" style="text-align:left">หัวข้อที่รองรับ: <strong>employee_code, employee_name, department, position, branch, start_date, employment_status, probation_required, level, rank, job_group</strong><br>start_date รูปแบบ YYYY-MM-DD · level 1-5 · rank 1-17 · job_group เช่น Store/Office (3 ตัวหลังไม่บังคับ)</div>
          <form id="impForm">
            <label class="m3-elabel">เลือกไฟล์ CSV</label><input class="m3-input" id="impFile" type="file" accept=".csv,text/csv">
            <label class="m3-elabel">หรือวาง CSV</label><textarea class="m3-textarea" name="csvText" placeholder="employee_code,employee_name,department,...&#10;6809145,สมชาย ใจดี,Operations,..."></textarea>
            <input type="hidden" name="fileName">
            <label class="m3-eitem" style="justify-content:space-between;margin-top:12px;cursor:pointer;gap:12px">
              <span style="flex:1">อัปเดตข้อมูลคนที่มีอยู่ด้วย<br><span style="font-size:11px;color:var(--m3-muted)">เติม Level/Rank/ข้อมูลที่ CSV มีให้คนเดิม · ช่องว่างไม่ทับของเดิม · ไม่แตะสถานะทดลองงาน</span></span>
              <input type="checkbox" name="updateExisting" value="1">
            </label>
            <button type="submit" class="m3-btn" style="margin-top:14px">${micon('upload_file')}นำเข้า</button>
          </form>
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('onboarding', body, { bar: { title: 'นำเข้า CSV', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderEmployeesM3() });
      const form = document.getElementById('impForm');
      const file = document.getElementById('impFile');
      file.addEventListener('change', async () => { const f = file.files && file.files[0]; if (!f) return; form.fileName.value = f.name; form.csvText.value = await f.text(); });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        try {
          const r = await api('/adminImportEmployees', Object.fromEntries(new FormData(event.currentTarget).entries()));
          adminCache = null;
          toast(`นำเข้าแล้ว: เพิ่มใหม่ ${r.newRows} · อัปเดต ${r.updatedRows || 0} · ข้าม ${r.skippedRows} · ผิดพลาด ${r.errorRows}`);
          renderEmployeesM3();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    async function renderUsersM3() {
      render(m3Loading('ผู้ใช้'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const users = data.users || [];
        const roleBadge = { HR: 'm3-badge--error', Mentor: 'm3-badge--ok', Mentee: '' };
        const body = `
          <section class="m3-section">
            <h2 class="m3-title">ผู้ใช้และสิทธิ์</h2>
            <p class="m3-eyebrow">${users.length} บัญชี</p>
          </section>
          <div class="m3-stickytop"><div class="m3-search">${micon('search')}<input id="usrSearch" placeholder="ค้นหาชื่อ อีเมล หรือแผนก"></div></div>
          <section class="m3-section">
            ${users.map(u => {
              const search = `${u.name || ''} ${u.email || ''} ${u.department || ''} ${u.role || ''}`.toLowerCase();
              return `
                <button type="button" class="m3-task-btn m3-pressable" data-usr-edit="${escapeHtml(u.userId)}" data-search="${escapeHtml(search)}">
                  <div style="display:flex;gap:12px;align-items:center">
                    <div class="m3-avatar">${escapeHtml(initials(u.name || u.displayName))}</div>
                    <div style="flex:1;min-width:0"><div class="m3-staff-name">${escapeHtml(u.name || u.displayName || '-')}</div><div class="m3-list-sub">${escapeHtml(u.department || '-')} · ${u.lineUserId ? micon('chat') + ' LINE: ' + escapeHtml(u.displayName || '—') : 'ยังไม่ผูก'}</div></div>
                    <span class="m3-badge ${roleBadge[u.role] || ''}">${escapeHtml(u.role || '-')}</span>
                  </div>
                </button>`;
            }).join('') || '<div class="m3-empty">ยังไม่มีผู้ใช้</div>'}
          </section>
        `;
        render(m3Shell('profile', body, { bar: { title: 'ผู้ใช้และสิทธิ์', back: true } }));
        wireM3Nav({ back: () => renderManageHub() });
        markHrView(renderUsersM3);
        const s = document.getElementById('usrSearch');
        s.addEventListener('input', () => { const k = s.value.trim().toLowerCase(); document.querySelectorAll('[data-usr-edit]').forEach(c => { c.style.display = !k || c.dataset.search.includes(k) ? '' : 'none'; }); });
        document.querySelectorAll('[data-usr-edit]').forEach(b => b.addEventListener('click', () => renderUserEditorM3(users.find(u => u.userId === b.dataset.usrEdit))));
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    function renderUserEditorM3(user) {
      if (!user) { renderUsersM3(); return; }
      const emps = (adminCache && adminCache.employees) || [];
      const currentEmp = emps.find(e => e.userId === user.userId);
      const unlinkedEmps = emps.filter(e => !e.userId).sort((a, b) => String(a.employeeCode || '').localeCompare(String(b.employeeCode || '')));
      const body = `
        <section class="m3-section">
          <h2 class="m3-title">แก้ไขผู้ใช้</h2>
          ${user.lineUserId ? `<div class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:12px;border-color:var(--m3-primary)"><div class="m3-list-icon">${micon('chat')}</div><div style="min-width:0"><div class="m3-staff-name">ผูกกับ LINE: ${escapeHtml(user.displayName || '—')}</div><div class="m3-staff-role">ตรวจว่าตรงกับตัวจริงไหม · ถ้าชื่อ LINE ไม่ตรงคน สงสัยแอบอ้าง → “ยกเลิกผูก” ที่ Master Data แล้วให้ตัวจริงผูกใหม่</div></div></div>` : ''}
          <form id="usrForm">
            <input type="hidden" name="userId" value="${escapeHtml(user.userId)}">
            <label class="m3-elabel">Role</label>
            <select class="m3-select" name="role">${[['HR', 'HR'], ['Executive', 'ผู้บริหาร'], ['Mentor', 'Mentor'], ['Mentee', 'Mentee']].map(([v, label]) => `<option value="${v}" ${user.role === v ? 'selected' : ''}>${label}</option>`).join('')}</select>
            <label class="m3-elabel">ชื่อ</label><input class="m3-input" name="name" required value="${escapeHtml(user.name || user.displayName || '')}">
            <label class="m3-elabel">แผนก</label><input class="m3-input" name="department" required value="${escapeHtml(user.department || '')}">
            <label class="m3-elabel">ตำแหน่ง</label><input class="m3-input" name="position" value="${escapeHtml(user.position || '')}">
            <label class="m3-elabel">อีเมล (ไม่บังคับ · ใช้ร่วมกันได้)</label><input class="m3-input" type="email" name="email" value="${escapeHtml(user.email || '')}">
            <label class="m3-elabel">สถานะ</label>
            <select class="m3-select" name="active"><option value="1" ${user.active ? 'selected' : ''}>ใช้งาน</option><option value="0" ${!user.active ? 'selected' : ''}>ปิดใช้งาน</option></select>
            <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}บันทึก</button>
          </form>
          <div class="m3-section" style="margin-top:18px;gap:6px">
            <div class="m3-section-label">ผูกกับพนักงาน Master Data</div>
            ${currentEmp
              ? `<div class="m3-card m3-card-pad"><div class="m3-staff-name">ผูกอยู่กับ: ${escapeHtml(currentEmp.employeeName || '')} (${escapeHtml(currentEmp.employeeCode || '')})</div><div class="m3-staff-role">${escapeHtml(currentEmp.department || '')}</div></div>`
              : '<p class="m3-save-hint" style="text-align:left">บัญชีนี้ยังไม่ผูกกับพนักงานใน Master Data</p>'}
            <label class="m3-elabel">เลือกพนักงานที่จะผูก (คงสิทธิ Role เดิม · ดึงชื่อ/แผนกจาก Master)</label>
            <select class="m3-select" id="usrLinkSel"><option value="">— เลือกพนักงาน —</option>${unlinkedEmps.map(e => `<option value="${escapeHtml(e.employeeId)}">${escapeHtml(e.employeeCode || '')} · ${escapeHtml(e.employeeName || '')} · ${escapeHtml(e.department || '')}</option>`).join('')}</select>
            <button type="button" class="m3-btn m3-btn--tonal" id="usrLink">${micon('link')}ผูกกับพนักงานนี้</button>
            <p class="m3-save-hint" style="text-align:left">ใช้เมื่ออยากให้บัญชีนี้เป็นตัวตนพนักงานจริง (เช่น HR ที่อยากมอบหมายหัวหน้าฝ่ายให้ตัวเองเพื่อทดสอบ) · ชื่อ/แผนก/ตำแหน่งจะอัปเดตจาก Master · <strong>ไม่แตะ Role</strong></p>
          </div>
          <div class="m3-section" style="margin-top:18px;gap:6px">
            <div class="m3-section-label" style="color:var(--m3-error)">โซนอันตราย</div>
            <button type="button" class="m3-btn m3-btn--outline" id="usrDelete" style="color:var(--m3-error);border-color:var(--m3-error)">${micon('person_remove')}ลบผู้ใช้</button>
            <p class="m3-save-hint" style="text-align:left">ลบบัญชี + ปลดการผูกพนักงาน · <strong>ไม่ใช่การแบนถาวร</strong> — คนนี้ยังลงทะเบียนใหม่ด้วยรหัสพนักงานเดิมได้ (ทะเบียนพนักงานยังอยู่) · จะกันถาวรต้อง <strong>ลบที่ Master Data (ลบพนักงาน)</strong> ด้วย · ถ้าแค่พักชั่วคราวใช้ “ปิดใช้งาน”</p>
          </div>
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('profile', body, { bar: { title: 'แก้ไขผู้ใช้', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderUsersM3() });
      wireValidation(document.getElementById('usrForm'));
      document.getElementById('usrForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!guardRequired(event.currentTarget)) return;
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        payload.active = payload.active === '1';
        const restore = busyButton(event.currentTarget.querySelector('button[type=submit]'));
        try { await api('/adminUpdateUser', payload); adminCache = null; toast('บันทึกผู้ใช้แล้ว'); renderUsersM3(); } catch (err) { restore(); toast(err.message, 'error'); }
      });
      const usrLinkBtn = document.getElementById('usrLink');
      if (usrLinkBtn) usrLinkBtn.addEventListener('click', async () => {
        const employeeId = document.getElementById('usrLinkSel').value;
        if (!employeeId) { toast('เลือกพนักงานก่อน', 'error'); return; }
        const sel = emps.find(e => e.employeeId === employeeId);
        if (!await confirmSheet({ title: 'ผูกบัญชีนี้กับพนักงาน?', desc: `ผูก ${user.name || user.displayName || user.userId} เข้ากับ ${sel ? (sel.employeeName + ' (' + sel.employeeCode + ')') : ''} · ชื่อ/แผนกจะอัปเดตจาก Master · Role คงเดิม`, confirmLabel: 'ผูก' })) return;
        const lr = busyButton(usrLinkBtn, 'กำลังผูก...');
        try { await api('/adminLinkEmployee', { userId: user.userId, employeeId }); adminCache = null; toast('ผูกกับพนักงานแล้ว'); renderUsersM3(); } catch (err) { lr(); toast(err.message, 'error'); }
      });
      document.getElementById('usrDelete').addEventListener('click', async () => {
        if (!await confirmSheet({ title: `ลบ ${user.name || user.displayName || user.userId}?`, desc: 'ลบบัญชี + ปลดการผูกพนักงาน · กู้คืนไม่ได้ — แต่ข้อมูลใน Master Data ยังอยู่ ทำให้คนนี้ยัง “ลงทะเบียนใหม่ด้วยรหัสเดิม” ได้ ถ้าต้องการกันเข้าระบบถาวร ให้ลบที่ Master Data (ลบพนักงาน) ด้วย', confirmLabel: 'ลบผู้ใช้', danger: true })) return;
        const dr = busyButton(document.getElementById('usrDelete'), 'กำลังลบ...');
        try { await api('/adminDeleteUser', { userId: user.userId }); adminCache = null; toast('ลบผู้ใช้แล้ว'); renderUsersM3(); } catch (err) { dr(); toast(err.message, 'error'); }
      });
    }

    /* ---- Groups (M3) ---- */
    async function renderGroupsM3() {
      render(m3Loading('กลุ่ม Onboarding'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const groups = data.groups || [];
        const members = data.groupMembers || [];
        const openSessions = (data.sessions || []).reduce((m, s) => { if (s.groupId && s.status !== 'Closed') m[s.groupId] = (m[s.groupId] || 0) + 1; return m; }, {});
        const card = g => {
          const gm = members.filter(m => m.groupId === g.groupId && m.active);
          const mentees = gm.filter(m => m.role === 'Mentee').length;
          const mentors = gm.filter(m => m.role === 'Mentor').length;
          return `
            <div class="m3-staff">
              <div class="m3-staff-head" style="margin-bottom:10px">
                <div><div class="m3-staff-name">${escapeHtml(g.groupName)}</div><div class="m3-staff-role">เริ่ม ${formatThaiDate(g.startDate)} · ทุก ${g.intervalDays} วัน · ${g.totalMonths} เดือน</div></div>
                <span class="m3-badge m3-badge--ok">${openSessions[g.groupId] || 0} session</span>
              </div>
              <div class="m3-staff-role" style="margin-bottom:10px">${micon('groups')} mentee ${mentees} · mentor ${mentors}</div>
              <div class="m3-tpl-actions">
                <button type="button" class="m3-btn m3-btn--tonal" data-grp-members="${escapeHtml(g.groupId)}">${micon('manage_accounts')}จัดการสมาชิก</button>
                <button type="button" class="m3-btn m3-btn--ghost" data-grp-session="${escapeHtml(g.groupId)}">${micon('event')}Session</button>
                <button type="button" class="m3-btn m3-btn--ghost" data-grp-del="${escapeHtml(g.groupId)}" style="color:var(--m3-error)">${micon('delete')}ลบกลุ่ม</button>
              </div>
            </div>`;
        };
        const body = `
          <section class="m3-section">
            <h2 class="m3-title">กลุ่ม Onboarding</h2>
            <p class="m3-eyebrow">${groups.length} กลุ่ม</p>
            <button type="button" class="m3-btn" data-grp-new>${micon('add')}สร้างกลุ่มใหม่</button>
          </section>
          <section class="m3-section">${groups.map(card).join('') || '<div class="m3-empty">ยังไม่มีกลุ่ม</div>'}</section>
        `;
        render(m3Shell('onboarding', body, { bar: { title: 'กลุ่ม Onboarding', back: true } }));
        wireM3Nav({ back: () => renderManageHub() });
        document.querySelector('[data-grp-new]').addEventListener('click', () => renderGroupEditorM3());
        document.querySelectorAll('[data-grp-members]').forEach(b => b.addEventListener('click', () => renderGroupMembersM3(groups.find(g => g.groupId === b.dataset.grpMembers), data)));
        document.querySelectorAll('[data-grp-session]').forEach(b => b.addEventListener('click', () => renderSessionEditorM3(null, data, b.dataset.grpSession)));
        document.querySelectorAll('[data-grp-del]').forEach(b => b.addEventListener('click', async () => {
          const gid = b.dataset.grpDel;
          const g = groups.find(x => x.groupId === gid) || {};
          const nMembers = members.filter(m => m.groupId === gid).length;
          const nSessions = (data.sessions || []).filter(s => s.groupId === gid).length;
          const nTasks = (data.tasks || []).filter(t => t.groupId === gid).length;
          const ok = await confirmSheet({ title: `ลบกลุ่ม "${g.groupName || ''}"?`, desc: `จะลบถาวร: สมาชิก ${nMembers} · session ${nSessions} · งาน ${nTasks} รายการ (รวมผลที่ส่งแล้ว) — กู้คืนไม่ได้`, confirmLabel: 'ลบกลุ่ม', danger: true });
          if (!ok) return;
          try { await api('/deleteOnboardingGroup', { groupId: gid }); adminCache = null; toast('ลบกลุ่มแล้ว'); renderGroupsM3(); }
          catch (e) { toast(e.message, 'error'); }
        }));
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    function renderGroupEditorM3() {
      const body = `
        <section class="m3-section">
          <h2 class="m3-title">สร้างกลุ่ม Onboarding</h2>
          <form id="grpForm">
            <label class="m3-elabel">ชื่อกลุ่ม</label><input class="m3-input" name="groupName" required placeholder="เช่น OB มิถุนายน รุ่น 4">
            <label class="m3-elabel">วันเริ่มรุ่น/กลุ่ม (baseline คำนวณรอบ OB)</label><input class="m3-input" type="date" name="startDate" required>
            <label class="m3-elabel">ระยะห่างแต่ละรอบ (วัน)</label><input class="m3-input" type="number" name="intervalDays" value="30" min="1">
            <label class="m3-elabel">จำนวนเดือน</label><input class="m3-input" type="number" name="totalMonths" value="4" min="1">
            <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}สร้างกลุ่ม</button>
          </form>
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('onboarding', body, { bar: { title: 'สร้างกลุ่ม', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderGroupsM3() });
      wireValidation(document.getElementById('grpForm'));
      document.getElementById('grpForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!guardRequired(event.currentTarget)) return;
        const restore = busyButton(event.currentTarget.querySelector('button[type=submit]'));
        try { await api('/createOnboardingGroup', Object.fromEntries(new FormData(event.currentTarget).entries())); adminCache = null; toast('สร้างกลุ่มแล้ว'); renderGroupsM3(); } catch (err) { restore(); toast(err.message, 'error'); }
      });
    }

    function renderGroupMembersM3(group, data) {
      const mentors = (data.users || []).filter(u => u.role === 'Mentor' && u.active);
      const mentees = (data.users || []).filter(u => u.role === 'Mentee' && u.active);
      const active = (data.groupMembers || []).filter(m => m.groupId === group.groupId && m.active);
      const menteeIds = new Set(active.filter(m => m.role === 'Mentee').map(m => m.userId));
      const mentorIds = new Set(active.filter(m => m.role === 'Mentor').map(m => m.userId));
      const defaultMentorId = active.find(m => m.role === 'Mentee' && m.mentorUserId)?.mentorUserId || '';
      if (defaultMentorId) mentorIds.add(defaultMentorId);
      const checkRow = (u, name) => {
        const search = `${u.name || ''} ${u.department || ''} ${u.email || ''}`.toLowerCase();
        return `<label class="m3-check-row" data-msearch="${escapeHtml(search)}"><input type="checkbox" name="${name}" value="${escapeHtml(u.userId)}" ${(name === 'mentorUserIds' ? mentorIds : menteeIds).has(u.userId) ? 'checked' : ''}><span><strong>${escapeHtml(u.name || u.displayName || u.userId)}</strong><small>${escapeHtml(u.department || '-')}${u.email ? ' · ' + escapeHtml(u.email) : ''}</small></span></label>`;
      };
      const body = `
        <section class="m3-section" style="gap:4px">
          <h2 class="m3-title">สมาชิก: ${escapeHtml(group.groupName)}</h2>
          <p class="m3-eyebrow">เลือก mentor และ mentee · ระบบจะสร้าง feedback task ให้ mentor ทุกคนประเมิน mentee ทุกคน</p>
        </section>
        <form id="grpMemForm">
          <input type="hidden" name="groupId" value="${escapeHtml(group.groupId)}">
          <label class="m3-elabel">Mentor หลัก (ค่าเริ่มต้น)</label>
          <select class="m3-select" name="mentorUserId"><option value="">ไม่กำหนด</option>${mentors.map(u => `<option value="${escapeHtml(u.userId)}" ${u.userId === defaultMentorId ? 'selected' : ''}>${escapeHtml(u.name || u.displayName)} (${escapeHtml(u.department || '-')})</option>`).join('')}</select>
          <label class="m3-elabel">Mentor ในกลุ่ม</label>
          <div class="m3-check-list">${mentors.map(u => checkRow(u, 'mentorUserIds')).join('') || '<div class="m3-empty">ยังไม่มี mentor</div>'}</div>
          <label class="m3-elabel">Mentee</label>
          <div class="m3-search" style="margin-bottom:8px">${micon('search')}<input id="memSearch" placeholder="ค้นหา mentee"></div>
          <div class="m3-check-list" id="menteeList">${mentees.map(u => checkRow(u, 'userIds')).join('') || '<div class="m3-empty">ยังไม่มี mentee ที่ผูก LINE</div>'}</div>
          <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}บันทึก & เตรียมงาน</button>
        </form>
        <div style="height:30px"></div>
      `;
      render(m3Shell('onboarding', body, { bar: { title: 'จัดการสมาชิก', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderGroupsM3() });
      const search = document.getElementById('memSearch');
      search.addEventListener('input', () => { const k = search.value.trim().toLowerCase(); document.querySelectorAll('#menteeList .m3-check-row').forEach(r => { r.style.display = !k || r.dataset.msearch.includes(k) ? '' : 'none'; }); });
      document.getElementById('grpMemForm').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = {
          groupId: form.groupId.value,
          mentorUserId: form.mentorUserId.value,
          mentorUserIds: [...form.querySelectorAll('input[name="mentorUserIds"]:checked')].map(o => o.value),
          userIds: [...form.querySelectorAll('input[name="userIds"]:checked')].map(o => o.value)
        };
        if (payload.mentorUserId && !payload.mentorUserIds.includes(payload.mentorUserId)) payload.mentorUserIds.push(payload.mentorUserId);
        try {
          const r = await api('/updateGroupMembers', payload);
          adminCache = null;
          toast(`บันทึกแล้ว · mentor ${r.activeMentors || 0} · mentee ${r.activeMentees || 0} · งานใหม่ ${r.createdTasks || 0}`);
          renderGroupsM3();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    /* ---- Sessions (M3) ---- */
    async function renderSessionsM3() {
      render(m3Loading('Session'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const sessions = data.sessions || [];
        const body = `
          <section class="m3-section">
            <h2 class="m3-title">Session / รอบงาน</h2>
            <p class="m3-eyebrow">${sessions.length} เซสชัน</p>
            <button type="button" class="m3-btn" data-ses-new>${micon('add')}สร้าง Session</button>
          </section>
          <section class="m3-section">
            ${sessions.length ? sessions.map(s => {
              const dm = dateDayMonth(s.sessionDate);
              return `
                <div class="m3-session m3-pressable" data-ses-edit="${escapeHtml(s.checkpointId)}">
                  <div class="m3-date-block"><span class="m3-date-day">${dm.day}</span><span class="m3-date-mon">${dm.mon}</span></div>
                  <div class="m3-session-body"><p class="m3-session-title">${escapeHtml(s.checkpointName || 'Session')}</p>
                  <div class="m3-session-meta"><span>${micon('schedule')}${escapeHtml(s.startTime || '-')}${s.endTime ? '-' + escapeHtml(s.endTime) : ''}</span>${s.room ? `<span>${micon('location_on')}${escapeHtml(s.room)}</span>` : ''}<span>${micon('groups')}${escapeHtml(renderSessionGroupName(s, data))}</span></div></div>
                  <span class="m3-badge">M${escapeHtml(s.monthNo || 1)}</span>
                </div>`;
            }).join('') : '<div class="m3-empty">ยังไม่มี session</div>'}
          </section>
        `;
        render(m3Shell('onboarding', body, { bar: { title: 'Session', back: true } }));
        wireM3Nav({ back: () => renderManageHub() });
        document.querySelector('[data-ses-new]').addEventListener('click', () => renderSessionEditorM3(null, data));
        document.querySelectorAll('[data-ses-edit]').forEach(b => b.addEventListener('click', () => renderSessionEditorM3(sessions.find(s => s.checkpointId === b.dataset.sesEdit), data)));
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    function renderSessionEditorM3(session, data, presetGroupId) {
      const s = session || {};
      const groups = data.groups || [];
      const body = `
        <section class="m3-section">
          <h2 class="m3-title">${s.checkpointId ? 'แก้ไข Session' : 'สร้าง Session'}</h2>
          <form id="sesForm">
            <input type="hidden" name="checkpointId" value="${escapeHtml(s.checkpointId || '')}">
            <label class="m3-elabel">กลุ่ม / รุ่น</label>
            <select class="m3-select" name="groupId" required>
              <option value="" disabled ${(s.groupId || presetGroupId) ? '' : 'selected'}>— เลือกกลุ่ม/รุ่น —</option>
              ${groups.map(g => `<option value="${escapeHtml(g.groupId)}" ${(s.groupId || presetGroupId) === g.groupId ? 'selected' : ''}>${escapeHtml(g.groupName)}</option>`).join('')}
            </select>
            <label class="m3-elabel">เดือนที่</label><input class="m3-input" type="number" name="monthNo" min="1" value="${escapeHtml(s.monthNo || 1)}">
            <label class="m3-elabel">ชื่อ Session</label><input class="m3-input" name="checkpointName" required value="${escapeHtml(s.checkpointName || '')}" placeholder="เช่น Month 1 - ปฐมนิเทศ">
            <label class="m3-elabel">วันนัดประชุม (วันจัด session จริง)</label><input class="m3-input" type="date" name="sessionDate" required value="${escapeHtml(s.sessionDate || '')}">
            <label class="m3-elabel">เวลาเริ่ม</label><input class="m3-input" type="time" name="startTime" value="${escapeHtml(s.startTime || '')}">
            <label class="m3-elabel">เวลาจบ</label><input class="m3-input" type="time" name="endTime" value="${escapeHtml(s.endTime || '')}">
            <label class="m3-elabel">ห้อง / ลิงก์</label><input class="m3-input" name="room" value="${escapeHtml(s.room || '')}">
            <label class="m3-elabel">รายละเอียด</label><textarea class="m3-textarea" name="description">${escapeHtml(s.description || '')}</textarea>
            <label class="m3-elabel">การสร้างงาน</label>
            <select class="m3-select" name="autoCreateTasks"><option value="1">สร้าง task ให้สมาชิกกลุ่มอัตโนมัติ</option><option value="0">บันทึก session อย่างเดียว</option></select>
            <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}บันทึก</button>
          </form>
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('onboarding', body, { bar: { title: s.checkpointId ? 'แก้ไข Session' : 'สร้าง Session', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderSessionsM3() });
      wireValidation(document.getElementById('sesForm'));
      document.getElementById('sesForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!guardRequired(event.currentTarget)) return;
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        const restore = busyButton(event.currentTarget.querySelector('button[type=submit]'));
        try {
          const r = await api(payload.checkpointId ? '/updateCheckpoint' : '/createCheckpoint', payload);
          adminCache = null;
          if (!payload.checkpointId) {
            toast(`สร้าง session แล้ว · งานใหม่ ${r.createdTasks || 0}`);
          } else if (await confirmSheet({ title: 'แจ้งกลุ่มเรื่องวันนัด?', desc: 'ส่งการ์ดแจ้งวันนัดนี้หาทุกคนในกลุ่ม + HR (ใช้ตอนเลื่อน/อัปเดตนัด)', confirmLabel: 'ส่งแจ้ง' })) {
            try {
              const a = await api('/announceSessionNow', { checkpointId: payload.checkpointId });
              toast(`ส่งแจ้งแล้ว · ผู้รับ ${a.recipients || 0} · สำเร็จ ${a.sent || 0}`);
            } catch (e) { toast('แจ้งไม่สำเร็จ: ' + e.message, 'error'); }
          }
          renderSessionsM3();
        } catch (err) { restore(); toast(err.message, 'error'); }
      });
    }

    /* ---- Messages + Automation (M3) ---- */
    async function renderMessagesM3() {
      render(m3Loading('ส่งข้อความ'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const linkedUsers = (data.users || []).filter(u => u.lineUserId);
        const templates = (data.templates || []).filter(t => t.active);
        const pendingTasks = (data.tasks || []).filter(t => t.status !== 'Completed');
        const tplOptions = `<option value="">ไม่ใช้ template</option>${templates.map(t => `<option value="${escapeHtml(t.templateId)}">${escapeHtml(t.title)} · ${escapeHtml(t.audience)}</option>`).join('')}`;
        const body = `
          <section class="m3-section" style="gap:4px"><h2 class="m3-title">ส่งข้อความ LINE</h2><p class="m3-eyebrow">ส่งรายคน / กลุ่ม และสั่ง automation</p></section>

          <section class="m3-section">
            <h3 class="m3-section-label">ส่งรายคน</h3>
            <form id="msgForm">
              <label class="m3-elabel">ผู้รับ</label>
              <select class="m3-select" name="userId" id="msgUser" required>${linkedUsers.map(u => `<option value="${escapeHtml(u.userId)}">${escapeHtml(u.name || u.displayName)} (${escapeHtml(u.role)})</option>`).join('')}</select>
              <label class="m3-elabel">Template</label>
              <select class="m3-select" id="msgTpl">${tplOptions}</select>
              <label class="m3-elabel">งาน (Flex, ถ้ามี)</label>
              <select class="m3-select" name="taskId" id="msgTask"><option value="">ส่งข้อความเตือนทั่วไป</option>${pendingTasks.map(t => `<option value="${escapeHtml(t.taskId)}" data-owner="${escapeHtml(t.ownerUserId)}">${escapeHtml(t.title)} · ${escapeHtml(t.taskType)}</option>`).join('')}</select>
              <label class="m3-elabel">ข้อความ</label>
              <textarea class="m3-textarea" name="message" required>แจ้งเตือนจาก Nose Tea Onboarding: กรุณาตรวจสอบงานของคุณใน LIFF</textarea>
              <button type="submit" class="m3-btn" style="margin-top:14px">${micon('send')}ส่งข้อความ</button>
            </form>
          </section>

          <section class="m3-section">
            <h3 class="m3-section-label">ส่งแบบกลุ่ม (Segment)</h3>
            <form id="segForm">
              <select class="m3-select" name="segment"><option value="linked">ทุกคนที่ผูก LINE</option><option value="mentors">Mentor ทั้งหมด</option><option value="mentees">Mentee ทั้งหมด</option><option value="pending">คนที่มีงานค้าง</option></select>
              <select class="m3-select" id="segTpl">${tplOptions}</select>
              <textarea class="m3-textarea" name="message" required>กรุณาเปิด LIFF เพื่อตรวจสอบงาน onboarding ของคุณ</textarea>
              <button type="submit" class="m3-btn m3-btn--tonal" style="margin-top:14px">${micon('campaign')}ส่งแบบกลุ่ม</button>
            </form>
          </section>

          <section class="m3-section">
            <h3 class="m3-section-label">ระบบอัตโนมัติ</h3>
            <div class="m3-card m3-card-pad">
              <p class="m3-staff-role" style="margin-bottom:10px">Sync กลุ่ม/รอบงาน และทดสอบส่ง Flex ตาม due (ปกติระบบส่งเอง 09:00 ทุกวัน) · ประกาศ Session จะส่งหา <strong>ทุกคนในกลุ่ม + HR</strong></p>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button type="button" class="m3-btn m3-btn--ghost" id="btnSync" style="flex:1 1 45%">${micon('sync')}Sync Lifecycle</button>
                <button type="button" class="m3-btn m3-btn--ghost" id="btnRunDaily" style="flex:1 1 45%">${micon('schedule_send')}รันส่งงานวันนี้</button>
                <button type="button" class="m3-btn m3-btn--ghost" id="btnAnnounce" style="flex:1 1 100%">${micon('campaign')}ส่งประกาศ Session (ทุก role)</button>
                <button type="button" class="m3-btn m3-btn--ghost" id="btnPreviewCard" style="flex:1 1 100%">${micon('style')}ส่งการ์ดตัวอย่างให้ฉัน (ทดสอบ/โชว์เคส)</button>
              </div>
              <p class="m3-save-hint" id="autoResult" style="text-align:left;margin-top:10px"></p>
            </div>
          </section>
          <div style="height:30px"></div>
        `;
        render(m3Shell('profile', body, { bar: { title: 'ส่งข้อความ', back: true } }));
        wireM3Nav({ back: () => renderManageHub() });

        const userSel = document.getElementById('msgUser');
        const taskSel = document.getElementById('msgTask');
        const msgForm = document.getElementById('msgForm');
        const tplSel = document.getElementById('msgTpl');
        const filterTasks = () => { [...taskSel.options].forEach((o, i) => { if (i === 0) return; o.hidden = o.dataset.owner !== userSel.value; }); if (taskSel.selectedOptions[0] && taskSel.selectedOptions[0].hidden) taskSel.value = ''; };
        userSel.addEventListener('change', filterTasks);
        tplSel.addEventListener('change', () => { const t = (data.templates || []).find(x => x.templateId === tplSel.value); if (t) msgForm.message.value = t.body || msgForm.message.value; });
        if (pendingMessageUserId) {
          if ([...userSel.options].some(o => o.value === pendingMessageUserId)) userSel.value = pendingMessageUserId;
          else toast('ผู้รับยังไม่ได้ผูกบัญชี LINE จึงส่งข้อความไม่ได้', 'error');
          pendingMessageUserId = '';
        }
        filterTasks();
        wireValidation(msgForm);
        msgForm.addEventListener('submit', async event => {
          event.preventDefault();
          if (!guardRequired(event.currentTarget)) return;
          const restore = busyButton(event.currentTarget.querySelector('button[type=submit]'), 'กำลังส่ง...');
          try { await api('/sendLineMessage', Object.fromEntries(new FormData(event.currentTarget).entries())); toast('ส่งข้อความแล้ว'); } catch (e) { toast(e.message, 'error'); } finally { restore(); }
        });

        const segForm = document.getElementById('segForm');
        const segTpl = document.getElementById('segTpl');
        segTpl.addEventListener('change', () => { const t = (data.templates || []).find(x => x.templateId === segTpl.value); if (t) segForm.message.value = t.body || segForm.message.value; });
        wireValidation(segForm);
        segForm.addEventListener('submit', async event => {
          event.preventDefault();
          if (!guardRequired(event.currentTarget)) return;
          const restore = busyButton(event.currentTarget.querySelector('button[type=submit]'), 'กำลังส่ง...');
          try { const r = await api('/sendSegmentLine', Object.fromEntries(new FormData(event.currentTarget).entries())); toast(`ส่งสำเร็จ ${r.sent} · ล้มเหลว ${r.failed}`); } catch (e) { toast(e.message, 'error'); } finally { restore(); }
        });

        const out = document.getElementById('autoResult');
        document.getElementById('btnSync').addEventListener('click', async event => {
          const b = event.currentTarget; b.disabled = true;
          try { const r = await api('/syncGroupLifecycle'); out.textContent = `Sync: checkpoint ${r.createdCheckpoints} · งานใหม่ ${r.createdTasks} · อัปเดต ${r.updatedTasks}`; adminCache = null; } catch (e) { toast(e.message, 'error'); } finally { b.disabled = false; }
        });
        document.getElementById('btnRunDaily').addEventListener('click', async event => {
          const b = event.currentTarget; b.disabled = true;
          try { const r = await api('/runDailyAutomation'); out.textContent = `ตรวจ ${r.candidates || 0} งาน · เลือก ${r.selected || 0} · ส่ง ${r.sent || 0} · ล้มเหลว ${r.failed || 0}`; } catch (e) { toast(e.message, 'error'); } finally { b.disabled = false; }
        });
        document.getElementById('btnAnnounce').addEventListener('click', async event => {
          const b = event.currentTarget; b.disabled = true;
          try { const r = await api('/runSessionAnnouncements'); out.textContent = `ประกาศ session: แจ้ง ${r.sessionsNotified || 0} รอบ · ส่ง ${r.sent || 0} · ล้มเหลว ${r.failed || 0}`; } catch (e) { toast(e.message, 'error'); } finally { b.disabled = false; }
        });
        document.getElementById('btnPreviewCard').addEventListener('click', async event => {
          const b = event.currentTarget; b.disabled = true;
          try { await api('/sendPreviewFlex', { role: 'Mentor' }); out.textContent = 'ส่งการ์ดตัวอย่างเข้า LINE ของคุณแล้ว (เช็คในแชท)'; } catch (e) { toast(e.message, 'error'); } finally { b.disabled = false; }
        });
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    async function renderMsgTemplatesM3() {
      render(m3Loading('คลังข้อความ'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const templates = data.templates || [];
        const body = `
          <section class="m3-section" style="gap:4px"><h2 class="m3-title">คลังข้อความ</h2><p class="m3-eyebrow">Template ข้อความ LINE ใช้ซ้ำ</p>
            <button type="button" class="m3-btn" data-tpl-msg-new>${micon('add')}สร้าง Template</button>
          </section>
          <section class="m3-section">
            ${templates.map(t => `
              <div class="m3-tpl-card">
                <div class="nm">${escapeHtml(t.title)}</div>
                <div class="sub">${escapeHtml(t.templateKey)} · ${escapeHtml(t.audience)} · ${t.active ? 'ใช้งาน' : 'ปิด'}</div>
                <div class="m3-staff-role" style="margin-top:6px">${escapeHtml((t.body || '').slice(0, 80))}</div>
                <div class="m3-tpl-actions"><button type="button" class="m3-btn m3-btn--tonal" data-tpl-msg-edit="${escapeHtml(t.templateId)}">${micon('edit')}แก้ไข</button></div>
              </div>`).join('') || '<div class="m3-empty">ยังไม่มี template</div>'}
          </section>
        `;
        render(m3Shell('profile', body, { bar: { title: 'คลังข้อความ', back: true } }));
        wireM3Nav({ back: () => renderManageHub() });
        document.querySelector('[data-tpl-msg-new]').addEventListener('click', () => renderMsgTemplateEditorM3(null));
        document.querySelectorAll('[data-tpl-msg-edit]').forEach(b => b.addEventListener('click', () => renderMsgTemplateEditorM3(templates.find(t => t.templateId === b.dataset.tplMsgEdit))));
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    function renderMsgTemplateEditorM3(tpl) {
      const t = tpl || {};
      const body = `
        <section class="m3-section">
          <h2 class="m3-title">${t.templateId ? 'แก้ไข Template' : 'สร้าง Template'}</h2>
          <form id="msgTplForm">
            <input type="hidden" name="templateId" value="${escapeHtml(t.templateId || '')}">
            <label class="m3-elabel">Template Key</label><input class="m3-input" name="templateKey" required value="${escapeHtml(t.templateKey || '')}" placeholder="เช่น month_1_reflection_due">
            <label class="m3-elabel">กลุ่มเป้าหมาย</label>
            <select class="m3-select" name="audience">${['All', 'Mentor', 'Mentee', 'HR'].map(a => `<option value="${a}" ${t.audience === a ? 'selected' : ''}>${a}</option>`).join('')}</select>
            <label class="m3-elabel">หัวข้อ</label><input class="m3-input" name="title" required value="${escapeHtml(t.title || '')}">
            <label class="m3-elabel">เนื้อหา</label><textarea class="m3-textarea" name="body" required>${escapeHtml(t.body || '')}</textarea>
            <label class="m3-elabel">ป้ายปุ่ม</label><input class="m3-input" name="buttonLabel" value="${escapeHtml(t.buttonLabel || 'Open LIFF')}">
            <label class="m3-elabel">สถานะ</label>
            <select class="m3-select" name="active"><option value="1" ${t.active !== false ? 'selected' : ''}>ใช้งาน</option><option value="0" ${t.active === false ? 'selected' : ''}>ปิด</option></select>
            <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}บันทึก</button>
          </form>
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('profile', body, { bar: { title: t.templateId ? 'แก้ไข Template' : 'สร้าง Template', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderMsgTemplatesM3() });
      document.getElementById('msgTplForm').addEventListener('submit', async event => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        payload.active = payload.active === '1';
        try { await api('/upsertMessageTemplate', payload); adminCache = null; renderMsgTemplatesM3(); } catch (err) { toast(err.message, 'error'); }
      });
    }

    /* ---- Onboarding List + Detail (Step 2) ---- */
    function mentorNameFor(member, data) {
      let mentor = member.mentorUserId ? (data.users || []).find(u => u.userId === member.mentorUserId) : null;
      if (!mentor) {
        const gm = (data.groupMembers || []).find(m => m.groupId === member.groupId && m.role === 'Mentor' && m.active);
        if (gm) mentor = (data.users || []).find(u => u.userId === gm.userId) || { name: gm.name };
      }
      return mentor ? (mentor.name || mentor.displayName) : null;
    }

    function buildOnboardingStaff(data) {
      const tasksByOwner = new Map();
      (data.tasks || []).forEach(task => {
        if (!tasksByOwner.has(task.ownerUserId)) tasksByOwner.set(task.ownerUserId, []);
        tasksByOwner.get(task.ownerUserId).push(task);
      });
      const empByUser = new Map((data.employees || []).filter(e => e.userId).map(e => [e.userId, e]));
      const uniqueByUser = new Map();
      (data.groupMembers || [])
        .filter(member => member.role === 'Mentee' && member.active)
        .forEach(member => {
          const current = uniqueByUser.get(member.userId);
          // prefer the membership that has a mentor assigned
          if (!current || (!current.mentorUserId && member.mentorUserId)) uniqueByUser.set(member.userId, member);
        });
      return [...uniqueByUser.values()]
        .map(member => {
          const own = tasksByOwner.get(member.userId) || [];
          const total = own.length;
          const done = own.filter(task => task.status === 'Completed').length;
          const percent = total ? Math.round((done / total) * 100) : 0;
          const monthNo = own.reduce((max, task) => Math.max(max, Number(task.monthNo || 0)), 0);
          const status = total === 0 ? 'รอเริ่ม' : (done === total ? 'เสร็จสิ้น' : 'กำลังดำเนิน');
          const emp = empByUser.get(member.userId) || {};
          const group = (data.groups || []).find(g => g.groupId === member.groupId);
          return {
            userId: member.userId,
            employeeId: emp.employeeId || null,
            name: member.name || emp.employeeName || member.userId,
            position: member.position || emp.position || '-',
            branch: emp.branch || '',
            dept: member.department || emp.department || '-',
            mentorName: mentorNameFor(member, data),
            groupId: member.groupId,
            groupName: group ? group.groupName : '',
            total, done, percent, monthNo, status, tasks: own
          };
        })
        .sort((a, b) => a.percent - b.percent);
    }

    function statusKeyOf(status) {
      if (status === 'รอเริ่ม') return 'pending';
      if (status === 'เสร็จสิ้น') return 'done';
      return 'active';
    }

    function onboardingStaffCard(staff) {
      const key = statusKeyOf(staff.status);
      const badge = key === 'done' ? 'm3-badge--ok' : (key === 'pending' ? 'm3-badge--warn' : '');
      const search = `${staff.name} ${staff.position} ${staff.branch} ${staff.dept}`.toLowerCase();
      return `
        <div class="m3-staff m3-pressable" data-ob-card="${escapeHtml(staff.userId)}" data-status="${key}" data-dept="${escapeHtml(staff.dept || '')}" data-search="${escapeHtml(search)}">
          <div class="m3-staff-head">
            <div class="m3-staff-id">
              <div class="m3-avatar">${escapeHtml(initials(staff.name))}</div>
              <div>
                <div class="m3-staff-name">${escapeHtml(staff.name)}</div>
                <div class="m3-staff-role">${escapeHtml(staff.position)}${staff.branch ? ' · ' + escapeHtml(staff.branch) : ''}</div>
              </div>
            </div>
            <span class="m3-badge ${badge}">${escapeHtml(staff.status)}</span>
          </div>
          <div class="m3-staff-mentor">${micon('person_pin')}<span>Mentor:</span> <strong>${escapeHtml(staff.mentorName || 'ยังไม่กำหนด')}</strong></div>
          <div class="m3-progress-head"><span class="m3-progress-cap">ความคืบหน้า</span><span class="m3-progress-pct">${staff.percent}%</span></div>
          <div class="m3-progress"><div class="m3-progress-bar" style="width:${staff.percent}%"></div></div>
        </div>
      `;
    }

    /* ---- Onboarding results summary + CSV export (Feedback / Reflection / Attendance) ---- */
    const OB_EXPORT_HEADERS = ['ประเภท', 'ชื่อพนักงาน', 'รหัสพนักงาน', 'ตำแหน่ง', 'แผนก', 'สาขา', 'กลุ่ม', 'Mentor', 'รอบ(เดือน)', 'ครบกำหนด', 'วันที่ส่ง', 'ความเข้าใจในงาน', 'การมีส่วนร่วม', 'การสื่อสาร', 'การปรับตัว', 'ความรับผิดชอบ', 'คะแนนรวม', 'เปอร์เซ็นต์', 'ข้อเสนอแนะ(Feedback)', 'สิ่งที่เรียนรู้', 'ความท้าทาย', 'ข้อเสนอแนะ(Reflection)', 'ขอความช่วยเหลือ', 'ยืนยันเข้าร่วม'];

    function obCompletedForms(data, groupId) {
      const types = new Set(['Feedback', 'Reflection', 'Attendance']);
      return (data.tasks || []).filter(t => types.has(t.taskType) && t.status === 'Completed' && (!groupId || t.groupId === groupId));
    }

    function obSubjectFromTitle(task) {
      const m = /\(([^)]+)\)\s*$/.exec(task.title || '');
      return m ? m[1] : '';
    }

    function obFeedbackScore(s) {
      let total = 0, answered = 0;
      OB_FEEDBACK_FIELDS.forEach(([k]) => { const v = Number(s[k] || 0); if (v) { total += v; answered += 1; } });
      const max = answered * 10;
      return { total, answered, max, pct: max ? Math.round((total / max) * 100) : 0 };
    }

    function obRowFor(task, lookups) {
      const emp = lookups.empById.get(task.employeeId) || {};
      const mentor = task.mentorUserId ? lookups.userById.get(task.mentorUserId) : null;
      const group = lookups.groupById.get(task.groupId);
      const s = task.submission || {};
      // Feedback owner is the mentor, so the subject name comes from the linked employee
      // or the "(name)" in the title; Reflection/Attendance are owned by the mentee, so
      // their owner user is a valid fallback when the employee link is not set yet.
      const ownerName = task.taskType !== 'Feedback' && lookups.userById.get(task.ownerUserId)
        ? lookups.userById.get(task.ownerUserId).name : '';
      const row = {
        'ประเภท': task.taskType,
        'ชื่อพนักงาน': emp.employeeName || obSubjectFromTitle(task) || ownerName || '-',
        'รหัสพนักงาน': emp.employeeCode || '-',
        'ตำแหน่ง': emp.position || '-',
        'แผนก': emp.department || '-',
        'สาขา': emp.branch || '-',
        'กลุ่ม': group ? group.groupName : '-',
        'Mentor': mentor ? mentor.name : '-',
        'รอบ(เดือน)': task.monthNo || '-',
        'ครบกำหนด': task.dueDate || '-',
        'วันที่ส่ง': task.submittedAt ? formatThaiDateTime(task.submittedAt) : '-'
      };
      OB_EXPORT_HEADERS.slice(11).forEach(h => { row[h] = ''; });
      if (task.taskType === 'Feedback') {
        const fb = obFeedbackScore(s);
        row['ความเข้าใจในงาน'] = s.understanding || '';
        row['การมีส่วนร่วม'] = s.participation || '';
        row['การสื่อสาร'] = s.communication || '';
        row['การปรับตัว'] = s.adaptability || '';
        row['ความรับผิดชอบ'] = s.responsibility || '';
        row['คะแนนรวม'] = fb.answered ? `${fb.total}/${fb.max}` : '';
        row['เปอร์เซ็นต์'] = fb.answered ? fb.pct : '';
        row['ข้อเสนอแนะ(Feedback)'] = s.comment || '';
      } else if (task.taskType === 'Reflection') {
        row['สิ่งที่เรียนรู้'] = s.learnings || '';
        row['ความท้าทาย'] = s.challenges || '';
        row['ข้อเสนอแนะ(Reflection)'] = s.suggestion || '';
        row['ขอความช่วยเหลือ'] = s.support || '';
      } else {
        row['ยืนยันเข้าร่วม'] = s.confirmed === 'yes' ? 'ใช่' : '';
      }
      return row;
    }

    function toCsv(headers, rows) {
      const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
      const lines = [headers.map(esc).join(',')];
      rows.forEach(r => lines.push(headers.map(h => esc(r[h])).join(',')));
      return '﻿' + lines.join('\r\n');
    }

    function downloadCsv(filename, csv) {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function deptOptions(list, selected = '') {
      const set = [...new Set((list || []).map(x => String(x || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      return ['<option value="">ทุกแผนก</option>'].concat(set.map(d => `<option value="${escapeHtml(d)}" ${d === selected ? 'selected' : ''}>${escapeHtml(d)}</option>`)).join('');
    }

    function renderObResults(data, groupId = '', dept = '') {
      const lookups = {
        empById: new Map((data.employees || []).map(e => [e.employeeId, e])),
        userById: new Map((data.users || []).map(u => [u.userId, u])),
        groupById: new Map((data.groups || []).map(g => [g.groupId, g]))
      };
      const forms = obCompletedForms(data, groupId)
        .filter(t => !dept || (lookups.empById.get(t.employeeId) || {}).department === dept);
      const feedbacks = forms.filter(t => t.taskType === 'Feedback');
      const reflections = forms.filter(t => t.taskType === 'Reflection');
      const attendances = forms.filter(t => t.taskType === 'Attendance');

      const dimSums = {}, dimCounts = {};
      OB_FEEDBACK_FIELDS.forEach(([k]) => { dimSums[k] = 0; dimCounts[k] = 0; });
      let pctSum = 0, pctN = 0;
      feedbacks.forEach(t => {
        const s = t.submission || {};
        OB_FEEDBACK_FIELDS.forEach(([k]) => { const v = Number(s[k] || 0); if (v) { dimSums[k] += v; dimCounts[k] += 1; } });
        const fb = obFeedbackScore(s);
        if (fb.answered) { pctSum += fb.pct; pctN += 1; }
      });
      const dimAvg = OB_FEEDBACK_FIELDS.map(([k, label]) => ({ k, label, avg: dimCounts[k] ? dimSums[k] / dimCounts[k] : null }));
      const rated = dimAvg.filter(d => d.avg != null);
      const lowest = rated.length ? rated.reduce((a, b) => b.avg < a.avg ? b : a) : null;
      const highest = rated.length ? rated.reduce((a, b) => b.avg > a.avg ? b : a) : null;
      const overallPct = pctN ? Math.round(pctSum / pctN) : null;

      const groupOptions = ['<option value="">ทุกกลุ่ม</option>'].concat(
        (data.groups || []).map(g => `<option value="${escapeHtml(g.groupId)}" ${g.groupId === groupId ? 'selected' : ''}>${escapeHtml(g.groupName)}</option>`)
      ).join('');

      const dimBars = rated.length ? dimAvg.map(d => {
        if (d.avg == null) return `<div class="m3-att-row"><span class="t">${escapeHtml(d.label)}</span><strong>-</strong></div>`;
        const pct = Math.round((d.avg / 10) * 100);
        const isLow = lowest && d.k === lowest.k, isHigh = highest && d.k === highest.k;
        const tag = isLow ? ' <span class="m3-badge m3-badge--warn">ต่ำสุด</span>' : (isHigh ? ' <span class="m3-badge m3-badge--ok">สูงสุด</span>' : '');
        return `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
              <span>${escapeHtml(d.label)}${tag}</span>
              <strong>${d.avg.toFixed(1)} / 10</strong>
            </div>
            <div class="m3-progress"><div class="m3-progress-bar" style="width:${pct}%"></div></div>
          </div>`;
      }).join('') : '<div class="m3-empty">ยังไม่มีผล Feedback ที่ส่งแล้ว</div>';

      const body = `
        <section class="m3-section">
          <div class="m3-section-head" style="align-items:center">
            <div><h2 class="m3-title">สรุปผล Feedback</h2><p class="m3-eyebrow">ค่าเฉลี่ยจากแบบฟอร์มที่ส่งแล้ว</p></div>
            <button type="button" class="m3-chip" id="obCsvBtn">${micon('download')}ดาวน์โหลด CSV</button>
          </div>
          <div style="display:flex;gap:8px">
            <select class="m3-select" id="obGroupFilter" style="flex:1">${groupOptions}</select>
            <select class="m3-select" id="obDeptFilter2" style="flex:1">${deptOptions((data.employees || []).map(e => e.department), dept)}</select>
          </div>
        </section>

        <section class="m3-section">
          <div class="m3-stat3">
            <div><div class="cap">Feedback</div><div class="val">${feedbacks.length}</div></div>
            <div><div class="cap">Reflection</div><div class="val">${reflections.length}</div></div>
            <div><div class="cap">เข้าร่วม</div><div class="val">${attendances.length}</div></div>
          </div>
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">คะแนนเฉลี่ย Feedback${overallPct != null ? ` · รวม ${overallPct}%` : ''}</h3>
          <div class="m3-card m3-card-pad">${dimBars}</div>
        </section>

        <section class="m3-section">
          <p class="m3-eyebrow">CSV รวมทุกฟอร์ม OB ที่ส่งแล้ว (${forms.length} รายการ) — เปิดใน Excel หรือส่งให้ AI วิเคราะห์ต่อได้</p>
        </section>
        <div style="height:24px"></div>
      `;
      render(m3Shell('onboarding', body, { bar: { title: 'สรุปผล Feedback', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderOnboardingList() });
      document.getElementById('obGroupFilter').addEventListener('change', e => renderObResults(data, e.target.value, dept));
      document.getElementById('obDeptFilter2').addEventListener('change', e => renderObResults(data, groupId, e.target.value));
      document.getElementById('obCsvBtn').addEventListener('click', () => {
        const rows = forms.map(t => obRowFor(t, lookups));
        downloadCsv('nose-tea-ob-forms.csv', toCsv(OB_EXPORT_HEADERS, rows));
      });
    }

    /* ---- Probation results summary + CSV export ---- */
    const PROB_EXPORT_HEADERS = ['ชื่อพนักงาน', 'รหัสพนักงาน', 'ตำแหน่ง', 'สาขา', 'แผนก', 'ผู้ประเมิน', 'รอบ(วัน)', 'แบบฟอร์ม', 'คะแนน', 'เต็ม', 'เกรด', 'ระดับ', 'วันที่ประเมิน', 'ผลทดลองงาน'];

    function probResultLabel(result) {
      return result === 'pass' ? 'ผ่าน' : (result === 'extend' ? 'ขยายเวลา' : '-');
    }

    function probCompletedEvals(data) {
      return (data.tasks || []).filter(t => t.taskType === 'Probation' && t.status === 'Completed' && t.submission && t.submission.score != null);
    }

    function probRowFor(task, lookups) {
      const kase = lookups.caseByEmp.get(task.employeeId) || {};
      const emp = lookups.empById.get(task.employeeId) || {};
      const s = task.submission || {};
      const tpl = lookups.tplById.get(s.templateId || kase.templateId) || {};
      const formLevel = (s.template && s.template.level) || tpl.level || 'staff';
      const day = s.day || Number(task.monthNo || 0) * 30 || '';
      return {
        'ชื่อพนักงาน': kase.employeeName || emp.employeeName || '-',
        'รหัสพนักงาน': emp.employeeCode || '-',
        'ตำแหน่ง': kase.position || emp.position || '-',
        'สาขา': kase.branch || emp.branch || '-',
        'แผนก': kase.department || emp.department || '-',
        'ผู้ประเมิน': kase.supervisorName || '-',
        'รอบ(วัน)': day,
        'แบบฟอร์ม': 'Form ' + probationFormLabel(formLevel),
        'คะแนน': s.score != null ? s.score : '',
        'เต็ม': 100,
        'เกรด': s.grade || '',
        'ระดับ': s.gradeLabel || '',
        'วันที่ประเมิน': task.submittedAt ? formatThaiDateTime(task.submittedAt) : '-',
        'ผลทดลองงาน': probResultLabel(kase.result)
      };
    }

    function renderProbationResults(data, dept = '') {
      const lookups = {
        caseByEmp: new Map((data.probationCases || []).map(c => [c.employeeId, c])),
        empById: new Map((data.employees || []).map(e => [e.employeeId, e])),
        tplById: new Map((data.probationTemplates || []).map(t => [t.templateId, t]))
      };
      const deptOf = employeeId => {
        const k = lookups.caseByEmp.get(employeeId), e = lookups.empById.get(employeeId);
        return (k && k.department) || (e && e.department) || '';
      };
      const evals = probCompletedEvals(data).filter(t => !dept || deptOf(t.employeeId) === dept);
      const scores = evals.map(t => Number(t.submission.score)).filter(n => !Number.isNaN(n));
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const gradeOrder = ['O', 'VG', 'G', 'N', 'U'];
      const gradeCount = {};
      evals.forEach(t => { const g = t.submission.grade; if (g) gradeCount[g] = (gradeCount[g] || 0) + 1; });
      const passCount = (data.probationCases || []).filter(c => c.result === 'pass' && (!dept || deptOf(c.employeeId) === dept)).length;
      const gradeChips = gradeOrder.filter(g => gradeCount[g]).map(g => `<span class="m3-badge">${g} · ${gradeCount[g]}</span>`).join(' ') || '-';

      const rows = evals.length ? evals.map(t => {
        const r = probRowFor(t, lookups);
        return `
          <div class="m3-card m3-card-pad" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div style="min-width:0">
              <div class="m3-staff-name">${escapeHtml(r['ชื่อพนักงาน'])}</div>
              <div class="m3-staff-role">รอบ ${r['รอบ(วัน)'] || '-'} วัน · ${escapeHtml(r['แบบฟอร์ม'])}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-weight:700">${r['คะแนน']}/100</div>
              <div class="m3-staff-role">เกรด ${escapeHtml(r['เกรด'] || '-')}</div>
            </div>
          </div>`;
      }).join('') : '<div class="m3-empty">ยังไม่มีผลประเมินทดลองงานที่ส่งแล้ว</div>';

      const body = `
        <section class="m3-section">
          <div class="m3-section-head" style="align-items:center">
            <div><h2 class="m3-title">สรุปผลทดลองงาน</h2><p class="m3-eyebrow">ผลประเมินที่ส่งแล้วทุกรอบ</p></div>
            <button type="button" class="m3-chip" id="probCsvBtn">${micon('download')}ดาวน์โหลด CSV</button>
          </div>
          <select class="m3-select" id="probResDeptFilter">${deptOptions((data.probationCases || []).map(c => deptOf(c.employeeId)), dept)}</select>
        </section>

        <section class="m3-section">
          <div class="m3-stat3">
            <div><div class="cap">ประเมินแล้ว</div><div class="val">${evals.length}</div></div>
            <div><div class="cap">คะแนนเฉลี่ย</div><div class="val">${avg != null ? avg : '-'}</div></div>
            <div><div class="cap">ผ่านแล้ว</div><div class="val">${passCount}</div></div>
          </div>
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">การกระจายเกรด</h3>
          <div class="m3-card m3-card-pad" style="display:flex;gap:8px;flex-wrap:wrap">${gradeChips}</div>
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">รายการประเมิน (${evals.length})</h3>
          ${rows}
        </section>
        <div style="height:24px"></div>
      `;
      render(m3Shell('probation', body, { bar: { title: 'สรุปผลทดลองงาน', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderProbationHome() });
      document.getElementById('probResDeptFilter').addEventListener('change', e => renderProbationResults(data, e.target.value));
      document.getElementById('probCsvBtn').addEventListener('click', () => {
        const csvRows = evals.map(t => probRowFor(t, lookups));
        downloadCsv('nose-tea-probation-results.csv', toCsv(PROB_EXPORT_HEADERS, csvRows));
      });
    }

    async function renderOnboardingList() {
      render(m3SkeletonScreen('onboarding', 'Onboarding'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const staff = buildOnboardingStaff(data);
        const body = `
          <section class="m3-section">
            <div class="m3-section-head" style="align-items:center">
              <div><h2 class="m3-title">Onboarding</h2></div>
              <button type="button" class="m3-chip" data-ob-results>${micon('insights')}สรุปผล</button>
            </div>
          </section>
          <div class="m3-stickytop">
            <div class="m3-search">${micon('search')}<input id="obSearch" placeholder="ค้นหาชื่อ ตำแหน่ง หรือสาขา"></div>
            <div class="m3-filterbar">
              <button type="button" class="m3-filter active" data-ob-filter="all">ทั้งหมด</button>
              <button type="button" class="m3-filter" data-ob-filter="active">กำลังดำเนิน</button>
              <button type="button" class="m3-filter" data-ob-filter="pending">รอเริ่ม</button>
              <button type="button" class="m3-filter" data-ob-filter="done">เสร็จสิ้น</button>
            </div>
            <select class="m3-select" id="obDeptFilter">${deptOptions(staff.map(s => s.dept))}</select>
          </div>
          <section class="m3-section m3-stagger" id="obList">
            ${staff.length ? staff.map(onboardingStaffCard).join('') : m3Empty('group_add', 'ยังไม่มีพนักงานในรอบ onboarding', 'สร้างกลุ่มแล้ว assign สมาชิก (ปุ่ม + ด้านล่างขวา)')}
          </section>
        `;
        render(m3Shell('onboarding', body, { bar: { title: 'Onboarding' }, fab: { icon: 'group_add', action: 'new-group', label: 'จัดการกลุ่ม' } }));
        wireM3Nav();
        const search = document.getElementById('obSearch');
        const deptFilter = document.getElementById('obDeptFilter');
        let activeFilter = 'all';
        const apply = () => {
          const keyword = (search.value || '').trim().toLowerCase();
          const dept = deptFilter.value;
          document.querySelectorAll('[data-ob-card]').forEach(card => {
            const matchKw = !keyword || card.dataset.search.includes(keyword);
            const matchFilter = activeFilter === 'all' || card.dataset.status === activeFilter;
            const matchDept = !dept || card.dataset.dept === dept;
            card.style.display = matchKw && matchFilter && matchDept ? '' : 'none';
          });
        };
        search.addEventListener('input', apply);
        deptFilter.addEventListener('change', apply);
        document.querySelectorAll('[data-ob-filter]').forEach(button => {
          button.addEventListener('click', () => {
            document.querySelectorAll('[data-ob-filter]').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            activeFilter = button.dataset.obFilter;
            apply();
          });
        });
        document.querySelectorAll('[data-ob-card]').forEach(card => {
          card.addEventListener('click', () => {
            const target = staff.find(item => item.userId === card.dataset.obCard);
            if (target) renderOnboardingDetail(target, data);
          });
        });
        const fab = document.querySelector('[data-m3-action="new-group"]');
        if (fab) fab.addEventListener('click', () => renderGroupsM3());
        const resBtn = document.querySelector('[data-ob-results]');
        if (resBtn) resBtn.addEventListener('click', () => renderObResults(data));
      } catch (error) {
        render(m3ErrorScreen(error.message));
      }
    }

    function onboardingTlItem(task) {
      const done = task.status === 'Completed';
      const active = !done && (task.status === 'Open' || task.status === 'Pending');
      const dotCls = done ? 'done' : (active ? 'active' : '');
      const cardCls = done ? '' : (active ? 'active' : 'pending');
      const badge = done
        ? '<span class="m3-badge m3-badge--ok">เสร็จ</span>'
        : (active ? '<span class="m3-badge">กำลังทำ</span>' : '<span class="m3-badge m3-badge--warn">รอ</span>');
      return `
        <div class="m3-tl-item">
          <div class="m3-tl-dot ${dotCls}">${done ? micon('check') : ''}</div>
          <div class="m3-tl-card ${cardCls}${done ? ' m3-pressable' : ''}"${done ? ` data-ob-view="${escapeHtml(task.taskId)}"` : ''}>
            <div>
              <div class="m3-tl-title">${escapeHtml(task.title || task.taskType)}</div>
              <div class="m3-tl-sub">${escapeHtml(task.taskType || '')} · ครบกำหนด ${formatThaiDate(task.dueDate)}</div>
            </div>
            ${done ? '<span class="m3-badge m3-badge--ok">ดูผล ›</span>' : badge}
          </div>
        </div>
      `;
    }

    function renderOnboardingDetail(staff, data) {
      const months = {};
      staff.tasks.forEach(task => {
        const month = Number(task.monthNo || 0) || 1;
        if (!months[month]) months[month] = { done: 0, total: 0 };
        months[month].total += 1;
        if (task.status === 'Completed') months[month].done += 1;
      });
      const monthKeys = Object.keys(months).map(Number).sort((a, b) => a - b);
      const timeline = [...staff.tasks].sort((a, b) =>
        (Number(a.monthNo || 0) - Number(b.monthNo || 0)) || String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
      const emp = (data.employees || []).find(item => item.userId === staff.userId);
      const isProbation = Boolean(emp && emp.probationRequired);

      const body = `
        <section class="m3-card m3-card-pad" style="display:flex;gap:16px;align-items:center">
          <div class="m3-avatar m3-avatar--lg">${escapeHtml(initials(staff.name))}</div>
          <div style="min-width:0">
            <h2 class="m3-headline">${escapeHtml(staff.name)}</h2>
            <p class="m3-staff-role">${escapeHtml(staff.position)}</p>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <span class="m3-badge m3-badge--ok">${escapeHtml(staff.dept)}</span>
              ${staff.branch ? `<span class="m3-badge">${escapeHtml(staff.branch)}</span>` : ''}
            </div>
          </div>
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">โปรแกรมของพนักงาน</h3>
          <div style="display:flex;gap:10px">
            <div class="m3-card m3-card-pad" style="flex:1;text-align:center;border-color:var(--m3-primary);box-shadow:0 0 0 1px var(--m3-primary)">
              ${micon('person_add')}<div style="font-weight:600;margin-top:4px;color:var(--m3-primary)">Onboarding</div>
              <div class="m3-staff-role">กำลังดู</div>
            </div>
            <div class="m3-card m3-card-pad ${isProbation ? 'm3-pressable' : ''}" data-ob-goprob style="flex:1;text-align:center;${isProbation ? '' : 'opacity:.5'}">
              ${micon('verified')}<div style="font-weight:600;margin-top:4px">Probation</div>
              <div class="m3-staff-role">${isProbation ? 'ต้องประเมิน' : 'ไม่ต้องประเมิน'}</div>
            </div>
          </div>
        </section>

        <section class="m3-card m3-card-pad">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
            <div><p class="m3-progress-cap">ความคืบหน้ารวม</p><p class="m3-title">${staff.percent}% เสร็จสิ้น</p></div>
            <p class="m3-staff-role">${staff.done}/${staff.total} งาน</p>
          </div>
          <div class="m3-progress"><div class="m3-progress-bar" style="width:${staff.percent}%"></div></div>
          ${monthKeys.length ? `<div class="m3-stat3">${monthKeys.slice(0, 3).map(month => {
            const obj = months[month];
            const pct = obj.total ? Math.round((obj.done / obj.total) * 100) : 0;
            return `<div><div class="cap">เดือน ${month}</div><div class="val">${pct}%</div></div>`;
          }).join('')}</div>` : ''}
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">Mentor ที่ดูแล</h3>
          <div class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:12px">
            <div class="m3-list-icon">${micon('person_pin')}</div>
            <div>
              <div class="m3-staff-name">${escapeHtml(staff.mentorName || 'ยังไม่กำหนด')}</div>
              <div class="m3-staff-role">Mentor ประจำกลุ่ม ${escapeHtml(staff.groupName || '-')}</div>
            </div>
          </div>
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">ไทม์ไลน์ Onboarding</h3>
          ${timeline.length ? `<div class="m3-timeline">${timeline.map(onboardingTlItem).join('')}</div>` : '<div class="m3-empty">ยังไม่มีงานในไทม์ไลน์</div>'}
        </section>

        <section class="m3-section" style="gap:10px">
          <button type="button" class="m3-btn" data-ob-remind>${micon('notifications')}ส่งเตือนผ่าน LINE</button>
          <button type="button" class="m3-btn m3-btn--outline" data-ob-edit>แก้ไขข้อมูลพนักงาน</button>
        </section>
      `;
      render(m3Shell('onboarding', body, { bar: { title: 'รายละเอียดพนักงาน', back: true } }));
      wireM3Nav({ back: () => renderOnboardingList() });
      const remind = document.querySelector('[data-ob-remind]');
      if (remind) remind.addEventListener('click', () => {
        pendingMessageUserId = staff.userId;
        renderMessagesM3();
      });
      const edit = document.querySelector('[data-ob-edit]');
      if (edit) edit.addEventListener('click', () => {
        const emp = (data.employees || []).find(e => e.employeeId === staff.employeeId);
        if (emp) renderEmployeeEditorM3(emp); else renderEmployeesM3();
      });
      const goProb = document.querySelector('[data-ob-goprob]');
      if (goProb && isProbation) goProb.addEventListener('click', () => {
        if (staff.employeeId) renderProbationDetail(staff.employeeId, data);
        else renderProbationHome();
      });
      document.querySelectorAll('[data-ob-view]').forEach(el => {
        el.addEventListener('click', () => {
          const tid = el.dataset.obView;
          const t = staff.tasks.find(x => x.taskId === tid);
          const back = () => renderOnboardingDetail(staff, data);
          if (t && t.taskType === 'Probation') openProbationPrint(tid, back);
          else openObFormView(tid, staff, back);
        });
      });
    }

    function isLineBrowser() {
      return /Line\//i.test(navigator.userAgent || '');
    }

    function webRedirectUri() {
      return `${window.location.origin}${window.location.pathname}`;
    }

    function startWebLogin() {
      const state = crypto.randomUUID();
      localStorage.setItem('noseTeaWebLoginState', state);
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: LINE_LOGIN_CHANNEL_ID,
        redirect_uri: webRedirectUri(),
        state,
        scope: 'profile openid'
      });
      window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    }

    async function completeWebLogin(code, state) {
      const expectedState = localStorage.getItem('noseTeaWebLoginState');
      localStorage.removeItem('noseTeaWebLoginState');
      if (!expectedState || expectedState !== state) {
        // The OAuth callback landed in a different browser context than the one that
        // started login (common on iOS "Add to Home Screen" standalone → Safari).
        // Clear the URL and show the clean login again so the user can retry in one context.
        window.history.replaceState({}, document.title, webRedirectUri());
        renderWebFallback();
        return;
      }
      const result = await api('/webLoginExchange', {
        code,
        redirectUri: webRedirectUri()
      });
      window.history.replaceState({}, document.title, webRedirectUri());
      if (result.registered === false && result.regToken) {
        // first time on web → register right here (no phone needed)
        renderRegister({ web: true, displayName: result.displayName, regToken: result.regToken });
        return;
      }
      webSessionToken = result.token;
      localStorage.setItem('noseTeaWebSession', webSessionToken);
      currentUser = result.user;
      await routeAfterWebLogin(result.user);
    }

    // HR → admin home ; พนักงาน (Mentor/Mentee) → portal (journey/tasks/profile) บน PC
    async function routeAfterWebLogin(user) {
      if (user && user.role === 'HR') { renderHrHome(); return; }
      if (user && user.role === 'Executive') { renderExecHome(); return; }
      const portal = await api('/getPortal');
      currentUser = portal.user || user;
      currentTasks = portal.tasks || [];
      renderUserPortal(portal.user || user, portal.tasks || [], { meta: portal });
    }

    function logoutWebAdmin() {
      webSessionToken = '';
      localStorage.removeItem('noseTeaWebSession');
      adminCache = null;
      currentUser = null;
      renderWebFallback();
    }

    function renderWebFallback(notice) {
      render(`
        <div class="m3-app m3-fade-up">
          <main class="m3-main" style="min-height:100vh;align-items:center;justify-content:center;text-align:center;gap:24px;padding-top:72px;padding-bottom:72px">
            <div class="m3-load-logo" style="animation:none;width:88px;height:88px;font-size:18px">
              <img class="m3-brand-img" src="/assets/logo.png?v=20260619-22" alt="Nose Tea" onerror="this.remove()"><span class="m3-brand-txt">Nose<br>Tea</span>
            </div>
            <div>
              <h1 class="m3-title">Nose Tea HR</h1>
              <p class="m3-eyebrow" style="margin-top:6px">เข้าสู่ระบบเพื่อดูงานและการประเมินของคุณ</p>
            </div>
            ${notice ? `<div class="m3-assign-card" style="max-width:320px;background:var(--m3-warn-bg);border-color:var(--m3-warn-fg)"><div class="cap" style="color:var(--m3-warn-fg)">${micon('info')}${escapeHtml(notice)}</div></div>` : ''}
            <div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:4px">
              <button type="button" class="m3-btn" id="webAdminLogin">${micon('login')}เข้าสู่ระบบด้วย LINE</button>
              <p class="m3-save-hint" style="text-align:center;margin:2px 0 0">ครั้งแรกก็ลงทะเบียนที่นี่ได้ · ใช้ได้ทั้ง PC และมือถือ</p>
              <div style="display:flex;align-items:center;gap:10px;color:var(--m3-outline-variant);font-size:12px;margin:12px 0 4px"><span style="flex:1;height:1px;background:currentColor"></span>หรือ<span style="flex:1;height:1px;background:currentColor"></span></div>
              <a class="m3-btn m3-btn--ghost" href="https://liff.line.me/2010372532-0i3JE94q" style="text-decoration:none">${micon('open_in_new')}เปิดในแอป LINE</a>
              <p class="m3-save-hint" style="text-align:center;margin:2px 0 0">แนะนำบนมือถือ — สะดวกกว่า + เพิ่มลงหน้าจอโฮมได้</p>
            </div>
            <div class="m3-card m3-card-pad" style="max-width:320px;text-align:left;display:flex;flex-direction:column;gap:6px">
              <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:14px">${micon('phone_iphone')}ใช้บน iPhone / iPad?</div>
              <div style="font-size:13px;color:var(--m3-muted);line-height:1.5">เปิดด้วยปุ่ม “เปิดผ่านแอป LINE” ด้านบน แล้วแตะ <strong>แชร์ ▸ เพิ่มลงในหน้าจอโฮม</strong> · ครั้งต่อไปกด icon เข้าใช้ได้เลย ไม่ต้องล็อกอินซ้ำ</div>
            </div>
          </main>
        </div>
      `);
      document.getElementById('webAdminLogin').addEventListener('click', startWebLogin);
    }

    async function api(path, payload = {}) {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          webSessionToken,
          lineUserId: lineProfile && lineProfile.userId,
          lineDisplayName: lineProfile && lineProfile.displayName,
          ...payload
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const msg = data.error || 'Request failed';
        // Web session expired/invalid (7-day TTL) → drop the stale token and bounce to a
        // clean login instead of dead-ending on an error screen. Halt the caller so its
        // own catch can't render over the login we just showed.
        if (webSessionToken && !isLineBrowser() && /web session required|admin access required|viewer access required|session expired/i.test(msg)) {
          webSessionToken = '';
          localStorage.removeItem('noseTeaWebSession');
          adminCache = null;
          renderWebFallback('เซสชันหมดอายุ (เกิน 7 วัน) กรุณาเข้าสู่ระบบใหม่');
          return new Promise(() => {});
        }
        throw new Error(msg);
      }
      // Pick up HR-editable OB Feedback captions whenever a response carries them (getPortal/adminData).
      if (data && Array.isArray(data.feedbackScale)) obFeedbackLabels = data.feedbackScale;
      return data;
    }

    function formatThaiDate(value) {
      if (!value) return '-';
      const date = new Date(`${value}T00:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatMonthTitle(value) {
      const date = value ? new Date(`${value}T00:00:00`) : new Date();
      if (Number.isNaN(date.getTime())) return 'เดือนนี้';
      return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    }

    function initials(name) {
      const text = String(name || 'N').trim();
      return text ? text.charAt(0).toUpperCase() : 'N';
    }

    function renderRegister(opts = {}) {
      const name = opts.displayName || (lineProfile && lineProfile.displayName ? lineProfile.displayName : '');
      const needsCode = Boolean(opts.needsCode);
      const body = `
        <section class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:12px;border-color:var(--m3-primary)">
          <div class="m3-list-icon">${micon('how_to_reg')}</div>
          <div style="min-width:0">
            <div class="m3-staff-name">ยืนยัน LINE สำเร็จ</div>
            <div class="m3-staff-role">${escapeHtml(name) || 'พร้อมลงทะเบียน'}</div>
          </div>
        </section>

        ${needsCode ? `<div class="m3-card m3-card-pad" style="background:var(--m3-warn-bg);border-color:var(--m3-warn-fg)"><p class="cap" style="color:var(--m3-warn-fg);margin:0">${micon('info')} บัญชีของคุณยังไม่ได้ผูกรหัสพนักงาน — กรุณากรอกรหัสให้ถูกต้องเพื่อเข้าใช้งาน</p></div>` : ''}

        <section class="m3-section" style="gap:4px">
          <h2 class="m3-title">ลงทะเบียนเข้าใช้งาน</h2>
          <p class="m3-eyebrow">กรอกรหัสพนักงานเพื่อเริ่มใช้งาน</p>
        </section>

        <form id="registerForm" class="m3-section">
          <label class="m3-elabel">รหัสพนักงาน (จำเป็น)</label>
          <input class="m3-input" name="employeeCode" placeholder="เช่น 6809145" inputmode="numeric" required autocomplete="off">
          <p class="m3-save-hint" style="text-align:left">ใช้<strong>รหัสที่ HR ออกให้เท่านั้น</strong> ระบบจะดึงชื่อ แผนก ตำแหน่ง และอีเมลของคุณจากข้อมูล HR ให้อัตโนมัติ · หากยังไม่มีรหัส หรือกรอกแล้วไม่ผ่าน กรุณาติดต่อ HR</p>

          <button type="submit" class="m3-btn" style="margin-top:16px">${micon('link')}บันทึกและผูกบัญชี LINE</button>
          <p class="m3-save-hint" style="text-align:left">สิทธิ์การใช้งานจะถูกกำหนดโดย HR ภายหลัง</p>
        </form>
        <div style="height:30px"></div>
      `;
      render(m3Shell('home', body, { bar: { title: 'ลงทะเบียน' }, noNav: true }));

      wireValidation(document.getElementById('registerForm'));
      document.getElementById('registerForm').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!guardRequired(form)) return;
        const restore = busyButton(form.querySelector('button'), 'กำลังผูกบัญชี...');
        try {
          const payload = Object.fromEntries(new FormData(form).entries());
          if (opts.regToken) payload.regToken = opts.regToken; // web first-time identity
          const result = await api('/registerUser', payload);
          currentUser = result.user;
          toast('ลงทะเบียนสำเร็จ');
          if (opts.web) {
            // web: log in with the session issued by registerUser, then route by role
            if (result.webToken) { webSessionToken = result.webToken; localStorage.setItem('noseTeaWebSession', webSessionToken); }
            await routeAfterWebLogin(result.user);
          } else {
            // Reload so a just-bound account immediately sees its real tasks/portal (not an empty one).
            const portal = await api('/getPortal');
            renderPortal(portal.user || result.user, portal.tasks || [], { meta: portal });
          }
        } catch (error) {
          restore();
          toast(error.message, 'error');
        }
      });
    }

    function sampleTasks(role) {
      if (role === 'Mentor') {
        return [
          {
            taskId: 'PV-FB1',
            title: 'Month 1 Feedback Form',
            taskType: 'Feedback',
            status: 'Pending',
            dueDate: '2026-06-20',
            target: 'Pimchanok S.',
            description: 'ประเมินความเข้าใจ การมีส่วนร่วม และความพร้อมของ mentee'
          },
          {
            taskId: 'PV-FB2',
            title: 'Month 2 Extra Evaluation',
            taskType: 'Feedback',
            status: 'Open',
            dueDate: '2026-07-20',
            target: 'Pimchanok S.',
            description: 'ติดตามพัฒนาการเพิ่มเติมหลังผ่านเดือนที่ 2'
          }
        ];
      }
      return [
        {
          taskId: 'PV-R1',
          title: 'Reflection Month 1',
          taskType: 'Reflection',
          status: 'Pending',
          dueDate: '2026-06-29',
          target: 'Self',
          description: 'บันทึก 3 สิ่งที่ได้เรียนรู้ 2 ความท้าทาย และ 1 ข้อเสนอแนะ'
        },
        {
          taskId: 'PV-A1',
          title: 'Attendance Confirmation',
          taskType: 'Attendance',
          status: 'Open',
          dueDate: '2026-06-15',
          target: 'Self',
          description: 'ยืนยันการเข้าร่วม onboarding session'
        }
      ];
    }

    function groupedMonthStats(tasks) {
      const months = Array.from(new Set(tasks.map(task => Number(task.monthNo || 0)).filter(Boolean))).sort((a, b) => a - b);
      const source = months.length ? months : [1, 2, 3, 4];
      return source.map(month => {
        const monthTasks = tasks.filter(task => Number(task.monthNo || 0) === month || String(task.title || '').includes(`Month ${month}`));
        const done = monthTasks.filter(task => task.status === 'Completed').length;
        const total = monthTasks.length;
        return { month, done, total, percent: total ? Math.round((done / total) * 100) : 0 };
      });
    }

    function addDaysToDateString(dateString, days) {
      if (!dateString) return '';
      const date = new Date(`${dateString}T00:00:00`);
      if (Number.isNaN(date.getTime())) return '';
      date.setDate(date.getDate() + Number(days || 0));
      return date.toISOString().slice(0, 10);
    }

    function renderPortal(user, tasks = [], options = {}) {
      currentUser = user;
      currentTasks = tasks || [];
      currentPortalMeta = options.meta || currentPortalMeta || {};
      if (user.role === 'HR' && !options.preview) {
        renderHrHome();
        return;
      }
      renderUserPortal(user, tasks, options);
      return;
    }

    function previewAs(role) {
      const fakeUser = {
        ...(currentUser || {}),
        role,
        name: role === 'Mentor' ? 'Kitti P. (Preview)' : 'Pimchanok S. (Preview)',
        displayName: role === 'Mentor' ? 'Kitti P.' : 'Pimchanok S.',
        department: role === 'Mentor' ? 'Marketing' : 'Operations',
        position: role === 'Mentor' ? 'Mentor' : 'New Hire'
      };
      const previewMeta = role === 'Mentor'
        ? {
            mentees: [
              { name: 'Pimchanok S.', department: 'Marketing', position: 'New Hire', currentMonth: 1, completedTasks: 1, totalTasks: 3, pendingFeedback: 1, progressPercent: 33 },
              { name: 'Nattapong K.', department: 'Operations', position: 'Barista', currentMonth: 2, completedTasks: 4, totalTasks: 5, pendingFeedback: 0, progressPercent: 80 }
            ]
          }
        : {};
      renderPortal(fakeUser, sampleTasks(role), { preview: true, meta: previewMeta });
    }

    function renderSessionGroupName(session, data) {
      const group = (data.groups || []).find(item => item.groupId === session.groupId);
      return group ? group.groupName : 'Manual / global';
    }

    // Executive dashboard — READ-ONLY org overview. Data comes pre-aggregated from
    // /execSummary (no per-person rows). No edit/CSV/manage affordances anywhere.
    // Turn the aggregate exec numbers into "gap + what to do" insights (north star: not just numbers).
    // Pure client-side over data /execSummary already returns — no backend change. KPI-based insights
    // will slot in here once ก้อน 4 lands.
    function execInsights(d) {
      const out = [];
      const dims = ((d.onboarding && d.onboarding.feedbackDims) || []).filter(x => x.avg != null);
      if (dims.length >= 2) {
        const s = [...dims].sort((a, b) => a.avg - b.avg);
        const low = s[0], high = s[s.length - 1];
        out.push({ tone: 'warn', icon: 'trending_down', title: `จุดที่ควรพัฒนา: ${low.label}`,
          detail: `เฉลี่ย ${low.avg.toFixed(1)}/10 — ต่ำสุดใน ${dims.length} ด้าน (ห่างจากด้านเด่น “${high.label}” ${(high.avg - low.avg).toFixed(1)} แต้ม)`,
          action: `ยกระดับ ${low.label} ทั้งองค์กร — เวิร์กช็อป / โค้ช / ตัวอย่างที่ดีจากคนเก่ง` });
        if (high.avg - low.avg >= 0.5) out.push({ tone: 'ok', icon: 'trending_up', title: `จุดแข็ง: ${high.label}`,
          detail: `เฉลี่ย ${high.avg.toFixed(1)}/10 — สูงสุดในองค์กร`, action: `ถอดบทเรียนความสำเร็จด้านนี้ไปเสริมด้านที่อ่อน` });
      }
      const byDept = ((d.onboarding && d.onboarding.byDept) || []).filter(x => x.overallPct != null);
      if (byDept.length >= 2) {
        const s = [...byDept].sort((a, b) => b.overallPct - a.overallPct);
        const top = s[0], bot = s[s.length - 1];
        if (top.overallPct - bot.overallPct >= 5) out.push({ tone: 'info', icon: 'compare_arrows', title: 'ช่องว่างระหว่างแผนก',
          detail: `${top.department} ${top.overallPct}% นำ ${bot.department} ${bot.overallPct}% (ห่าง ${top.overallPct - bot.overallPct}%)`,
          action: `ถ่ายทอด best practice จาก ${top.department} → ${bot.department}` });
      }
      const overdue = (d.kpis && d.kpis.tasksOverdue) || 0;
      if (overdue > 0) out.push({ tone: 'warn', icon: 'schedule', title: `งานเลยกำหนด ${overdue} ชิ้นทั้งองค์กร`,
        detail: 'งานที่ยังไม่เสร็จและเลยวันครบกำหนด', action: 'กระตุ้นหัวหน้าที่เกี่ยวข้องให้ปิดงานค้าง' });
      return out;
    }

    async function renderExecHome(options = {}) {
      const isPreview = Boolean(options.preview);
      render(m3Loading('ภาพรวมองค์กร'));
      let d, portal;
      try {
        [d, portal] = await Promise.all([api('/execSummary'), api('/getPortal')]);
      } catch (error) {
        render(m3ErrorScreen(error.message));
        return;
      }
      // KPI corporate rollup (optional — KPI feature may not be set up yet; never block exec home).
      const kpiDash = await api('/kpi/dashboard', {}).catch(() => null);
      // An Executive can also be assigned as a probation evaluator (Option C, per-case grant).
      // Surface those tasks here so they're reachable from the dashboard, not only via LINE.
      const myEvals = ((portal && portal.tasks) || []).filter(t => t.taskType === 'Probation' && t.status !== 'Completed');
      const k = d.kpis || {};
      const ob = d.onboarding || {};
      const prob = d.probation || {};
      const obDone = ob.completed || {};
      const isWeb = webSessionToken && !isLineBrowser();
      const execName = (d.currentUser && (d.currentUser.name || d.currentUser.displayName)) || 'ผู้บริหาร';

      const kpi = (label, val, color) => `<div class="m3-card m3-card-pad" style="text-align:center;padding:14px 6px"><div style="font-size:11.5px;color:var(--m3-muted)">${escapeHtml(label)}</div><div style="font-size:25px;font-weight:700;margin-top:3px${color ? `;color:${color}` : ''}">${val}</div></div>`;
      const row = (left, right) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #e6efea"><span>${escapeHtml(left)}</span><strong>${right}</strong></div>`;

      // KPI corporate rollup section (only when the KPI feature has data)
      const kpiSectionHtml = (kpiDash && (kpiDash.kpis || []).length) ? (() => {
        const rows = kpiDash.kpis;
        const scored = rows.filter(r => r.pct != null);
        const gap = scored.length ? [...scored].sort((a, b) => a.pct - b.pct)[0] : null;
        const barRow = kp => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span>${escapeHtml(kp.title)}</span><strong>${kp.pct != null ? kp.pct + '%' : '—'}</strong></div>${kp.pct != null ? `<div class="m3-progress"><div class="m3-progress-bar" style="width:${kp.pct}%"></div></div>` : ''}</div>`;
        return `
          <section class="m3-section">
            <h3 class="m3-section-label">คะแนน KPI องค์กร${kpiDash.cycle ? ' · ปี ' + kpiDash.cycle.year + ' ' + escapeHtml(kpiDash.cycle.period) : ''}</h3>
            <div class="m3-card m3-card-pad" style="text-align:center;border-color:var(--m3-primary)">
              <div class="m3-eyebrow">คะแนนรวม (เฉพาะที่อนุมัติแล้ว)</div>
              <div style="font-size:28px;font-weight:800;color:var(--m3-primary);margin-top:2px">${kpiDash.total || 0} <span style="font-size:14px;color:var(--m3-muted)">/ ${kpiDash.scoredWeight || 0}</span></div>
            </div>
            ${gap ? `<div class="m3-card m3-card-pad" style="border-left:4px solid #ef7b2f;margin-top:10px"><div class="m3-staff-name">🎯 KPI ที่ควรเร่งพัฒนา</div><div class="m3-list-sub" style="margin-top:2px">${escapeHtml(gap.title)} — ทั้งองค์กรทำได้ ${gap.pct}%</div></div>` : ''}
            <div class="m3-card m3-card-pad" style="margin-top:10px">${rows.map(barRow).join('')}</div>
          </section>`;
      })() : '';

      const dimBars = (ob.feedbackDims || []).length ? ob.feedbackDims.map(dim => {
        if (dim.avg == null) return `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span>${escapeHtml(dim.label)}</span><strong>-</strong></div>`;
        const pct = Math.round((dim.avg / 10) * 100);
        return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span>${escapeHtml(dim.label)}</span><strong>${dim.avg.toFixed(1)} / 10</strong></div><div class="m3-progress"><div class="m3-progress-bar" style="width:${pct}%"></div></div></div>`;
      }).join('') : '<div class="m3-empty">ยังไม่มีผล Feedback ที่ส่งแล้ว</div>';

      const obDept = (ob.byDept || []).length
        ? ob.byDept.map(r => row(r.department, `${r.overallPct != null ? r.overallPct + '%' : '-'} <span style="color:var(--m3-muted);font-weight:400">· ${r.feedbackForms} ฟอร์ม</span>`)).join('')
        : '<div class="m3-empty">—</div>';

      const grades = prob.grades || {};
      const gradeChips = ['O', 'VG', 'G', 'N', 'U'].filter(g => grades[g]).map(g => `<span class="m3-badge">${g} · ${grades[g]}</span>`).join(' ') || '-';

      const probDept = (prob.byDept || []).length
        ? prob.byDept.map(r => row(r.department, `${r.avgScore != null ? r.avgScore : '-'} <span style="color:var(--m3-muted);font-weight:400">· ${r.evaluated} ราย · ผ่าน ${r.passCount}</span>`)).join('')
        : '<div class="m3-empty">—</div>';

      const body = `
        <div class="m3-app m3-fade-up">
          <header class="m3-appbar">
            <div class="m3-appbar-brand">
              <div class="m3-brand-logo"><img class="m3-brand-img" src="/assets/logo.png?v=20260626-01" alt="Nose Tea" onerror="this.remove()"><span class="m3-brand-txt">Nose<br>Tea</span></div>
              <h1 class="m3-appbar-title">ภาพรวมองค์กร</h1>
            </div>
            ${isWeb ? `<button type="button" class="m3-iconbtn" id="execLogout" aria-label="ออกจากระบบ">${micon('logout')}</button>` : ''}
          </header>
          <main class="m3-main m3-stagger">
            ${isPreview ? `<div class="m3-assign-card" style="background:var(--m3-warn-bg);border-color:var(--m3-warn-fg)"><div class="cap" style="color:var(--m3-warn-fg)">โหมด Preview (Executive) · <button type="button" data-exec-back style="background:none;border:0;color:var(--m3-warn-fg);text-decoration:underline;font-weight:700;font-family:inherit">กลับ Admin</button></div></div>` : ''}
            <section class="m3-section" style="gap:4px">
              <h2 class="m3-title">สวัสดี ${escapeHtml(execName)}</h2>
              <p class="m3-eyebrow">ภาพรวมการ Onboarding และทดลองงานทั้งองค์กร · มุมมองผู้บริหาร (ดูอย่างเดียว)</p>
            </section>

            <section class="m3-section">
              <h3 class="m3-section-label">🎯 สิ่งที่ควรโฟกัส</h3>
              ${(() => {
                const insights = execInsights(d);
                if (!insights.length) return '<div class="m3-empty">ยังไม่มีข้อมูลพอสำหรับ insight — เมื่อมีผลประเมิน/Feedback มากขึ้น ระบบจะวิเคราะห์ช่องว่างให้อัตโนมัติ</div>';
                return insights.map(ins => {
                  const color = ins.tone === 'warn' ? '#ef7b2f' : (ins.tone === 'ok' ? 'var(--m3-primary)' : '#3b6fb0');
                  return `<div class="m3-card m3-card-pad" style="border-left:4px solid ${color};margin-bottom:10px">
                    <div style="display:flex;gap:10px;align-items:flex-start">
                      <span style="color:${color};flex:none">${micon(ins.icon)}</span>
                      <div style="flex:1;min-width:0">
                        <div class="m3-staff-name">${escapeHtml(ins.title)}</div>
                        <div class="m3-list-sub" style="margin-top:2px">${escapeHtml(ins.detail)}</div>
                        <div style="margin-top:6px;font-size:12.5px;color:var(--m3-primary)">→ ควรทำ: ${escapeHtml(ins.action)}</div>
                      </div>
                    </div>
                  </div>`;
                }).join('');
              })()}
            </section>

            ${myEvals.length ? `
            <section class="m3-section">
              <h3 class="m3-section-label">งานประเมินที่มอบหมายให้คุณ (${myEvals.length})</h3>
              ${myEvals.map(t => `
                <button type="button" class="m3-task-btn m3-pressable" data-eval="${escapeHtml(t.taskId)}">
                  <div style="display:flex;gap:12px;align-items:center">
                    <div class="m3-list-icon">${micon('assignment_ind')}</div>
                    <div style="flex:1;min-width:0;text-align:left"><div class="m3-staff-name">${escapeHtml(t.title || 'ประเมินทดลองงาน')}</div><div class="m3-list-sub">ครบกำหนด ${t.dueDate ? formatThaiDate(t.dueDate) : '-'}</div></div>
                    ${micon('chevron_right')}
                  </div>
                </button>
              `).join('')}
            </section>` : ''}

            <section class="m3-section">
              <h3 class="m3-section-label">ตัวเลขสำคัญ</h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:10px">
                ${kpi('พนักงานทั้งหมด', k.employees || 0)}
                ${kpi('กำลังทดลองงาน', k.probationActive || 0)}
                ${kpi('ผ่านทดลองงาน', k.probationPassed || 0, 'var(--m3-primary)')}
                ${kpi('งานยังไม่เสร็จ', k.tasksOpen || 0)}
                ${kpi('เกินกำหนด', k.tasksOverdue || 0, '#ef7b2f')}
              </div>
            </section>

            ${kpiSectionHtml}

            <section class="m3-section">
              <h3 class="m3-section-label">Onboarding · ฟอร์มที่ส่งแล้ว</h3>
              <div class="m3-stat3">
                <div><div class="cap">Feedback</div><div class="val">${obDone.feedback || 0}</div></div>
                <div><div class="cap">Reflection</div><div class="val">${obDone.reflection || 0}</div></div>
                <div><div class="cap">เข้าร่วม</div><div class="val">${obDone.attendance || 0}</div></div>
              </div>
            </section>

            <section class="m3-section">
              <h3 class="m3-section-label">คะแนนเฉลี่ย Feedback${ob.overallPct != null ? ` · รวม ${ob.overallPct}%` : ''}</h3>
              <div class="m3-card m3-card-pad">${dimBars}</div>
            </section>

            <section class="m3-section">
              <h3 class="m3-section-label">Feedback แยกแผนก</h3>
              <div class="m3-card m3-card-pad">${obDept}</div>
            </section>

            <section class="m3-section">
              <h3 class="m3-section-label">ทดลองงาน</h3>
              <div class="m3-stat3">
                <div><div class="cap">ประเมินแล้ว</div><div class="val">${prob.evaluated || 0}</div></div>
                <div><div class="cap">คะแนนเฉลี่ย</div><div class="val">${prob.avgScore != null ? prob.avgScore : '-'}</div></div>
                <div><div class="cap">ผ่านแล้ว</div><div class="val">${prob.passCount || 0}</div></div>
              </div>
            </section>

            <section class="m3-section">
              <h3 class="m3-section-label">การกระจายเกรด</h3>
              <div class="m3-card m3-card-pad" style="display:flex;gap:8px;flex-wrap:wrap">${gradeChips}</div>
            </section>

            <section class="m3-section">
              <h3 class="m3-section-label">ทดลองงานแยกแผนก</h3>
              <div class="m3-card m3-card-pad">${probDept}</div>
            </section>

            <p class="m3-eyebrow" style="text-align:center;opacity:.7">ข้อมูล ณ ${formatThaiDateTime(d.generatedAt)}</p>
            <div style="height:30px"></div>
          </main>
        </div>
      `;
      render(body);
      const logout = document.getElementById('execLogout');
      if (logout) logout.addEventListener('click', logoutWebAdmin);
      const execBack = document.querySelector('[data-exec-back]');
      if (execBack) execBack.addEventListener('click', () => renderHrHome());
      // Wire the assigned-evaluation tasks (if any) to open the eval form.
      currentTasks = (portal && portal.tasks) || [];
      currentPortalMeta = portal || {};
      document.querySelectorAll('[data-eval]').forEach(btn => {
        btn.addEventListener('click', () => openProbationEval(btn.dataset.eval, () => renderExecHome(options)));
      });
    }

    // True = friend OR cannot determine (fail-open: never block on API hiccup).
    async function checkOaFriendship() {
      try {
        if (typeof liff === 'undefined' || !liff.getFriendship) return true;
        const fs = await liff.getFriendship();
        return Boolean(fs && fs.friendFlag);
      } catch (error) {
        return true;
      }
    }

    function renderAddFriendGate() {
      const body = `
        <section class="m3-card m3-card-pad" style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;border-color:var(--m3-primary)">
          <div class="m3-list-icon" style="width:64px;height:64px">${micon('waving_hand')}</div>
          <div class="m3-title">อีกขั้นเดียวก็เริ่มได้</div>
          <p class="m3-eyebrow" style="max-width:320px;line-height:1.7">เพิ่มเพื่อน <strong>${escapeHtml(OA_DISPLAY_NAME)}</strong> เพื่อรับแจ้งเตือนงานผ่าน LINE แล้วกลับมากดปุ่ม “เข้าสู่ระบบ”</p>
          <ol style="text-align:left;max-width:320px;font-size:13.5px;line-height:1.9;padding-left:20px;margin:0;align-self:center">
            <li>กด <strong>“เพิ่มเพื่อน”</strong> ปุ่มเขียวด้านล่าง</li>
            <li>ในหน้าที่เด้งขึ้น กด <strong>“เพิ่มเพื่อน”</strong> อีกครั้ง</li>
            <li>กด <strong>ปิด (✕) มุมบน</strong> กลับมาหน้านี้ → กด <strong>“เข้าสู่ระบบ”</strong></li>
          </ol>
          <button type="button" class="m3-btn" id="oaAdd" style="width:100%;max-width:300px">${micon('add')}เพิ่มเพื่อน ${escapeHtml(OA_DISPLAY_NAME)}</button>
          <button type="button" class="m3-btn m3-btn--tonal" id="oaDone" style="width:100%;max-width:300px">${micon('login')}เพิ่มเพื่อนแล้ว · เข้าสู่ระบบ</button>
          <p class="m3-save-hint" style="max-width:320px;line-height:1.6">เผลอเข้าหน้าแชท? แตะปุ่ม <strong>“เริ่มใช้งานระบบ”</strong> ในแชท หรือเปิดลิงก์เดิมที่ HR ส่งให้อีกครั้ง</p>
        </section>
        <div style="height:24px"></div>
      `;
      render(m3Shell('home', body, { bar: { title: 'เพิ่มเพื่อน LINE' }, noNav: true }));
      let proceeding = false;
      const proceed = () => { if (proceeding) return; proceeding = true; document.removeEventListener('visibilitychange', onVisible); boot(); };
      // getFriendship() ลากช้าหลังเพิ่งเพิ่มเพื่อน (propagation) — ลองซ้ำสองสามครั้งก่อนสรุป
      const checkFriendRetry = async (tries) => {
        for (let i = 0; i < tries; i++) {
          if (await checkOaFriendship()) return true;
          if (i < tries - 1) await new Promise(r => setTimeout(r, 700));
        }
        return false;
      };
      // Open the add-friend screen WITHOUT leaving the LIFF (openWindow overlays; app stays alive).
      document.getElementById('oaAdd').addEventListener('click', () => {
        try {
          if (typeof liff !== 'undefined' && liff.openWindow) liff.openWindow({ url: OA_ADD_URL, external: false });
          else window.location.href = OA_ADD_URL;
        } catch (e) { window.location.href = OA_ADD_URL; }
      });
      // Auto-continue when the user returns after adding (best-effort).
      const onVisible = async () => { if (document.visibilityState === 'visible' && !proceeding && await checkOaFriendship()) proceed(); };
      document.addEventListener('visibilitychange', onVisible);
      // Manual confirm — ELIMINATE the dead-end: retry the friendship check, then continue no matter
      // what (they said they added; if getFriendship still lags, don't trap them on this screen).
      document.getElementById('oaDone').addEventListener('click', async event => {
        busyButton(event.currentTarget, 'กำลังเข้าสู่ระบบ...');
        const ok = await checkFriendRetry(3);
        if (!ok) toast('เข้าสู่ระบบแล้ว — หากยังไม่ได้เพิ่มเพื่อน กรุณาเพิ่ม Nose Tea Care เพื่อรับการแจ้งเตือน', 'info');
        proceed();
      });
    }

    async function boot() {
      try {
        if (!isLineBrowser()) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          const state = params.get('state');
          if (code && state) {
            render(m3Loading('กำลังเข้าสู่ระบบ'));
            await completeWebLogin(code, state);
            return;
          }
          if (webSessionToken) {
            // Returning web user (PC) — fetch who they are and route: HR → admin, employee → portal
            render(m3Loading('กำลังเข้าสู่ระบบ'));
            const portal = await api('/getPortal');
            if (portal.disabled) {
              render(`<div class="m3-app m3-fade-up">${m3TopBar({ title: 'Nose Tea' })}<main class="m3-main" style="align-items:center;text-align:center;gap:16px;padding-top:56px"><div class="m3-list-icon m3-list-icon--error" style="width:64px;height:64px">${micon('block')}</div><h2 class="m3-title">บัญชีถูกปิดใช้งาน</h2><p class="m3-eyebrow" style="max-width:280px">บัญชีนี้ถูกปิดใช้งานโดย HR<br>หากเป็นข้อผิดพลาด กรุณาติดต่อฝ่ายบุคคล</p></main></div>`);
              return;
            }
            if (portal.needsEmployeeCode) {
              render(`<div class="m3-app m3-fade-up">${m3TopBar({ title: 'Nose Tea' })}<main class="m3-main" style="align-items:center;text-align:center;gap:16px;padding-top:56px"><div class="m3-list-icon" style="width:64px;height:64px;background:var(--m3-warn-bg);color:var(--m3-warn-fg)">${micon('badge')}</div><h2 class="m3-title">ต้องผูกรหัสพนักงานก่อน</h2><p class="m3-eyebrow" style="max-width:300px">บัญชีของคุณยังไม่ได้ผูกรหัสพนักงาน กรุณาเปิดระบบผ่าน<strong>แอป LINE</strong>เพื่อกรอกรหัสพนักงาน หรือติดต่อ HR</p><button type="button" class="m3-btn m3-btn--outline" style="max-width:280px" data-web-logout>${micon('logout')}ออกจากระบบ</button></main></div>`);
              const lo = document.querySelector('[data-web-logout]');
              if (lo) lo.addEventListener('click', logoutWebAdmin);
              return;
            }
            if (!portal.registered || !portal.user) { renderWebFallback(); return; }
            await routeAfterWebLogin(portal.user);
            return;
          }
          renderWebFallback();
          return;
        }
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        lineProfile = await liff.getProfile();
        idToken = liff.getIDToken() || '';
        if (!(await checkOaFriendship())) {
          renderAddFriendGate();
          return;
        }
        const portal = await api('/getPortal');
        if (portal.disabled) {
          render(`<div class="m3-app m3-fade-up">${m3TopBar({ title: 'Nose Tea' })}<main class="m3-main" style="align-items:center;text-align:center;gap:16px;padding-top:56px"><div class="m3-list-icon m3-list-icon--error" style="width:64px;height:64px">${micon('block')}</div><h2 class="m3-title">บัญชีถูกปิดใช้งาน</h2><p class="m3-eyebrow" style="max-width:280px">บัญชีนี้ถูกปิดใช้งานโดย HR<br>หากเป็นข้อผิดพลาด กรุณาติดต่อฝ่ายบุคคล</p></main></div>`);
          return;
        }
        if (!portal.registered) {
          renderRegister(portal.needsEmployeeCode ? { needsCode: true, displayName: portal.displayName } : {});
          return;
        }
        const taskId = new URLSearchParams(window.location.search).get('taskId');
        if (taskId) {
          const task = (portal.tasks || []).find(item => item.taskId === taskId);
          if (task) {
            currentTasks = portal.tasks || [];
            currentPortalMeta = portal;
            if (task.taskType === 'Probation') {
              openProbationEval(taskId, async () => {
                const reload = await api('/getPortal');
                renderPortal(reload.user, reload.tasks || [], { meta: reload });
              });
              return;
            }
            renderM3TaskForm(portal.user, task, { meta: portal });
            return;
          }
        }
        if (portal.user && portal.user.role === 'Executive') { renderExecHome(); return; }
        renderPortal(portal.user, portal.tasks || [], { meta: portal });
      } catch (error) {
        render(`
          <div class="m3-app m3-fade-up">
            ${m3TopBar({ title: 'Nose Tea' })}
            <main class="m3-main" style="align-items:center;text-align:center;gap:18px;padding-top:48px">
              <div class="m3-list-icon m3-list-icon--error" style="width:64px;height:64px">${micon('error')}</div>
              <div><h2 class="m3-title">เปิดระบบไม่สำเร็จ</h2><p class="m3-eyebrow" style="margin-top:6px">${escapeHtml(error.message || 'เกิดข้อผิดพลาด')}</p></div>
              <button type="button" class="m3-btn" style="max-width:280px" onclick="location.reload()">${micon('refresh')}ลองใหม่อีกครั้ง</button>
            </main>
          </div>
        `);
      }
    }

    // ---- Bridge for feature modules (kpi.js / feedback360.js) — see HANDOFF §0.1 ----
    // Small, explicit allowlist of shared helpers/state. New modules use these; they must NOT copy
    // helpers or touch app.js internals directly. Adding to this list must be deliberate + documented.
    window.NT = {
      api, render, toast, confirmSheet, busyButton, haptic,
      m3Shell, m3TopBar, wireM3Nav, micon, escapeHtml, formatThaiDate,
      goProfile: () => renderHrProfile(),        // return to the HR "จัดการระบบ" hub
      goPortal: () => renderUserPortal(currentUser, currentTasks, { meta: currentPortalMeta, preview: portalPreviewMode }), // back to the employee portal (keeps preview banner so HR can exit)
      invalidate: () => { adminCache = null; },  // let a module force-refresh shared admin data
      user: () => currentUser
    };

    boot();

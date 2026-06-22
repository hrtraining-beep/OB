const LIFF_ID = '2010372532-0i3JE94q';
    const LINE_LOGIN_CHANNEL_ID = '2010372532';
    const API_BASE = 'https://nose-tea-onboarding-api.hrtraining.workers.dev';
    let lineProfile = null;
    let idToken = '';
    let currentUser = null;
    let adminCache = null;
    let currentTasks = [];
    let currentPortalMeta = {};
    let portalTab = 'home';
    let adminActiveTab = 'dashboard';
    let adminNotice = null;
    let pendingMessageUserId = '';
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
      const root = document.getElementById('app');
      const incoming = String(html || '');
      root.innerHTML = hasMojibakeHint(incoming)
        ? applyKnownTextReplacements(repairMojibake(incoming))
        : incoming;
      normalizeRenderedText(root);
    }

    function shell(title, body) {
      return `
        <main class="screen center">
          <section class="card">
            <div class="hero">
              <div class="logo">Nose<br>Tea</div>
              <div class="eyebrow">Nose Tea Onboarding</div>
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
      render(m3Loading());
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        render(hrHomeMarkup(data));
        wireM3Nav();
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
        const fab = document.querySelector('[data-m3-action="add-staff"]');
        if (fab) fab.addEventListener('click', () => go('add-staff'));
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
      let currentAssigned = false;
      return [{ m: 1, d: 30 }, { m: 2, d: 60 }, { m: 3, d: 90 }].map(({ m, d }) => {
        const task = byMonth.get(m) || null;
        let state;
        if (!task) state = 'locked';
        else if (task.status === 'Completed') state = 'done';
        else if (!currentAssigned) { state = 'current'; currentAssigned = true; }
        else state = 'upcoming';
        return { day: d, monthNo: m, state, task };
      });
    }

    function probationStatusOf(kase) {
      if (!kase || !kase.supervisorUserId) return { key: 'pending', label: 'รอมอบหมาย', badge: 'm3-badge--warn' };
      if (kase.result === 'pass') return { key: 'pass', label: 'ผ่าน', badge: 'm3-badge--ok' };
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
      const search = `${row.emp.employeeName} ${row.emp.position || ''} ${row.emp.branch || ''} ${row.emp.employeeCode || ''}`.toLowerCase();
      return `
        <div class="m3-staff m3-pressable" data-prob-card="${escapeHtml(row.emp.employeeId)}" data-status="${row.status.key}" data-search="${escapeHtml(search)}">
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
      render(m3Loading('Probation'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const rows = buildProbationRows(data);
        const body = `
          <section class="m3-section">
            <div class="m3-section-head" style="align-items:center">
              <div><h2 class="m3-title">Probation</h2><p class="m3-eyebrow">ติดตามการประเมินทดลองงาน 30/60/90 วัน</p></div>
              <button type="button" class="m3-chip" data-prob-templates>${micon('description')}แบบฟอร์ม</button>
            </div>
            <div class="m3-search">${micon('search')}<input id="probSearch" placeholder="ค้นหาชื่อ รหัส หรือสาขา"></div>
            <div class="m3-filterbar">
              <button type="button" class="m3-filter active" data-prob-filter="all">ทั้งหมด</button>
              <button type="button" class="m3-filter" data-prob-filter="reviewing">กำลังประเมิน</button>
              <button type="button" class="m3-filter" data-prob-filter="pending">รอมอบหมาย</button>
              <button type="button" class="m3-filter" data-prob-filter="pass">ผ่าน</button>
              <button type="button" class="m3-filter" data-prob-filter="extended">ขยายเวลา</button>
            </div>
          </section>
          <section class="m3-section" id="probList">
            ${rows.length ? rows.map(probationCard).join('') : '<div class="m3-empty">ยังไม่มีพนักงานทดลองงาน<br>ตั้งค่า probation_required ใน Employee Master หรือ import CSV</div>'}
          </section>
        `;
        render(m3Shell('probation', body, { bar: { title: 'Probation' } }));
        wireM3Nav();
        const templatesBtn = document.querySelector('[data-prob-templates]');
        if (templatesBtn) templatesBtn.addEventListener('click', () => renderTemplateList(data));
        const search = document.getElementById('probSearch');
        let activeFilter = 'all';
        const apply = () => {
          const keyword = (search.value || '').trim().toLowerCase();
          document.querySelectorAll('[data-prob-card]').forEach(card => {
            const matchKw = !keyword || card.dataset.search.includes(keyword);
            const matchFilter = activeFilter === 'all' || card.dataset.status === activeFilter;
            card.style.display = matchKw && matchFilter ? '' : 'none';
          });
        };
        search.addEventListener('input', apply);
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
      const dueKey = ms.day === 30 ? 'day30Due' : (ms.day === 60 ? 'day60Due' : 'day90Due');
      const due = row.kase ? row.kase[dueKey] : (ms.task && ms.task.dueDate);
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

    function renderProbationDetail(employeeId, data) {
      const rows = buildProbationRows(data);
      const row = rows.find(item => item.emp.employeeId === employeeId);
      if (!row) { renderProbationHome(); return; }
      const tenure = daysSince(row.emp.startDate);
      const mentors = (data.users || []).filter(user => user.role === 'Mentor' && user.active);
      const hasSupervisor = Boolean(row.kase && row.kase.supervisorUserId);

      const supervisorBlock = hasSupervisor
        ? `<div class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:12px">
             <div class="m3-list-icon">${micon('supervisor_account')}</div>
             <div><div class="m3-staff-name" style="font-size:15px">${escapeHtml(row.kase.supervisorName || '-')}</div><div class="m3-staff-role">หัวหน้างานผู้ประเมิน</div></div>
           </div>`
        : `<div class="m3-assign-card">
             <div class="cap">${micon('person_alert')} ยังไม่ได้มอบหมายหัวหน้าประเมิน</div>
             <select class="m3-select" id="probTemplate">
               ${(data.probationTemplates || []).filter(t => t.active !== false).map(t => `<option value="${escapeHtml(t.templateId)}">${escapeHtml(t.name)}</option>`).join('') || '<option value="PT-C">Form C</option>'}
             </select>
             <select class="m3-select" id="probSupervisor">
               <option value="">เลือกหัวหน้างาน (Mentor)</option>
               ${mentors.map(user => `<option value="${escapeHtml(user.userId)}">${escapeHtml(user.name || user.displayName)} (${escapeHtml(user.department || '-')})</option>`).join('')}
             </select>
             <button type="button" class="m3-btn" data-prob-assign="${escapeHtml(row.emp.employeeId)}">${micon('check')}มอบหมาย & สร้างงานประเมิน</button>
           </div>`;
      const currentMilestone = row.milestones.find(ms => ms.state === 'current' && ms.task);

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
          <h3 class="m3-section-label">หัวหน้างานผู้ประเมิน</h3>
          ${supervisorBlock}
        </section>

        <section class="m3-section">
          <h3 class="m3-section-label">เส้นทางการประเมิน</h3>
          <div class="m3-timeline">${row.milestones.map(ms => probationTlItem(ms, row)).join('')}</div>
        </section>

        ${hasSupervisor ? `
        <section class="m3-section" style="gap:10px">
          ${currentMilestone ? `<button type="button" class="m3-btn" data-prob-eval="${escapeHtml(currentMilestone.task.taskId)}">${micon('assignment')}ทำแบบประเมินรอบ ${currentMilestone.day} วัน</button>` : ''}
          <div style="display:flex;gap:10px">
            <button type="button" class="m3-btn" style="background:var(--m3-primary)" data-prob-result="pass" data-case="${escapeHtml(row.kase.caseId)}">${micon('verified')}อนุมัติผ่าน</button>
            <button type="button" class="m3-btn m3-btn--outline" data-prob-result="extend" data-case="${escapeHtml(row.kase.caseId)}">ขยายเวลา</button>
          </div>
          <button type="button" class="m3-btn m3-btn--ghost" data-prob-remind="${escapeHtml(row.kase.supervisorUserId)}">${micon('notifications')}ส่งเตือนหัวหน้าผ่าน LINE</button>
        </section>` : ''}
      `;
      render(m3Shell('probation', body, { bar: { title: 'ประเมินทดลองงาน', back: true } }));
      wireM3Nav({ back: () => renderProbationHome() });

      const assign = document.querySelector('[data-prob-assign]');
      if (assign) assign.addEventListener('click', async () => {
        const supervisorUserId = document.getElementById('probSupervisor').value;
        const templateId = document.getElementById('probTemplate') ? document.getElementById('probTemplate').value : '';
        if (!supervisorUserId) { alert('กรุณาเลือกหัวหน้างาน'); return; }
        assign.disabled = true; assign.textContent = 'กำลังบันทึก...';
        try {
          await api('/assignProbationSupervisor', { employeeId: assign.dataset.probAssign, supervisorUserId, templateId });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          renderProbationDetail(employeeId, fresh);
        } catch (error) { alert(error.message); assign.disabled = false; }
      });

      document.querySelectorAll('[data-prob-result]').forEach(button => {
        button.addEventListener('click', async () => {
          const result = button.dataset.probResult;
          if (!confirm(result === 'pass' ? 'ยืนยันอนุมัติผ่านทดลองงาน?' : 'ยืนยันขยายเวลาทดลองงาน?')) return;
          try {
            await api('/updateProbationCase', { caseId: button.dataset.case, status: result === 'pass' ? 'completed' : 'active', result });
            adminCache = null;
            const fresh = await api('/adminData');
            adminCache = fresh;
            renderProbationDetail(employeeId, fresh);
          } catch (error) { alert(error.message); }
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

    function scoreOptions(points, selected) {
      return `<option value="">-</option>` + (points || []).map(p =>
        `<option value="${p}" ${String(selected) === String(p) ? 'selected' : ''}>${p}</option>`).join('');
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
          <div class="m3-eval-item" data-comp-sec="${idx}" data-i="${i}">
            <div class="t">${i + 1}. ${escapeHtml(item.label)}</div>
            <select data-comp-score>${scoreOptions(sec.scale.points, (st.scores || [])[i])}</select>
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
          <h2 class="m3-title" style="font-size:22px">ประเมินทดลองงาน ${day ? day + ' วัน' : ''}</h2>
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
            st[idx] = { scores: [...container.querySelectorAll(`[data-comp-sec="${idx}"] [data-comp-score]`)].map(s => s.value) };
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
          template: { name: template.name, sections: template.sections, ratingBands: template.ratingBands }
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
          if (sec.maxItems && container.querySelectorAll(`[data-kpi-sec="${idx}"]`).length >= sec.maxItems) { alert(`เพิ่มได้สูงสุด ${sec.maxItems} ข้อ`); return; }
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
        if (container.querySelectorAll(`[data-kpi-sec="${idx}"]`).length <= (sec.minItems || 1)) { alert(`ต้องมีอย่างน้อย ${sec.minItems || 1} ข้อ`); return; }
        row.remove();
        onChange();
      });

      document.querySelector('[data-eval-draft]').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api('/saveTaskDraft', { taskId: task.taskId, submission: buildSubmission() });
          hint.textContent = 'บันทึกร่างแล้ว';
        } catch (e) { alert(e.message); }
        button.disabled = false;
      });

      document.querySelector('[data-eval-submit]').addEventListener('click', async event => {
        recompute();
        for (let idx = 0; idx < template.sections.length; idx++) {
          const sec = template.sections[idx];
          if (sec.type === 'kpi') {
            const rows = state[idx].rows.filter(r => r.label.trim() || Number(r.score) > 0);
            if (rows.length < (sec.minItems || 1)) { alert(`กรุณากรอก ${sec.title} อย่างน้อย ${sec.minItems} ข้อ พร้อมให้คะแนน`); return; }
            if (rows.some(r => !r.label.trim() || !(Number(r.score) > 0))) { alert(`กรุณากรอกหัวข้อและคะแนนให้ครบใน ${sec.title}`); return; }
          }
          if (sec.type === 'competency' && state[idx].scores.some(s => !(Number(s) > 0))) {
            alert(`กรุณาให้คะแนนครบทุกข้อใน ${sec.title}`); return;
          }
        }
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'กำลังส่ง...';
        try {
          await api('/submitTask', { taskId: task.taskId, submission: buildSubmission() });
          try { localStorage.removeItem(localKey); } catch (e) {}
          alert('ส่งผลประเมินเรียบร้อย');
          back();
        } catch (e) {
          alert(e.message);
          button.disabled = false;
          button.textContent = 'ส่งผลประเมิน';
        }
      });

      recompute();
    }

    async function openProbationEval(taskId, back) {
      render(m3Loading('แบบประเมิน'));
      try {
        const res = await api('/getTask', { taskId });
        if (!res.probation || !res.probation.template) {
          alert('ไม่พบแบบฟอร์มประเมินสำหรับงานนี้');
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
          <div class="pdoc-title">${escapeHtml(template.name)}${p.day ? ` (รอบ ${p.day} วัน)` : ''}</div>
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
        if (!res.probation || !res.probation.template) { alert('ไม่พบแบบฟอร์ม'); back(); return; }
        if (!res.task.submission || !res.task.submission.state) { alert('ยังไม่มีผลประเมินสำหรับรอบนี้'); back(); return; }
        render(`
          <div class="pdoc-screen">
            <div class="pdoc-toolbar no-print">
              <button type="button" class="m3-btn" id="pdocPrint" style="width:auto">${micon('print')}พิมพ์ / บันทึก PDF</button>
              <button type="button" class="m3-btn m3-btn--ghost" id="pdocBack" style="width:auto">${micon('arrow_back')}กลับ</button>
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
      const usedIds = new Set((data.probationCases || []).map(c => c.templateId).filter(Boolean));
      const active = templates.filter(t => t.active !== false);
      const trashed = templates.filter(t => t.active === false);
      const card = tpl => {
        const sum = (tpl.sections || []).filter(s => ['kpi', 'competency', 'attendance'].includes(s.type)).reduce((a, s) => a + Number(s.weight || 0), 0);
        const parts = (tpl.sections || []).filter(s => s.weight != null).map(s => `${sectionTypeLabel(s.type).split(' ')[0]} ${s.weight}%`).join(' · ');
        const locked = usedIds.has(tpl.templateId);
        return `
          <div class="m3-tpl-card">
            <div class="nm">${escapeHtml(tpl.name)} ${locked ? '<span class="m3-badge" style="vertical-align:middle">🔒 ใช้แล้ว</span>' : ''}</div>
            <div class="sub">${escapeHtml(parts || 'ไม่มีส่วนให้คะแนน')} · รวม ${sum}%</div>
            <div class="m3-tpl-actions">
              <button type="button" class="m3-btn m3-btn--tonal" data-tpl-edit="${escapeHtml(tpl.templateId)}">${micon(locked ? 'visibility' : 'edit')}${locked ? 'ดู' : 'แก้ไข'}</button>
              <button type="button" class="m3-btn m3-btn--ghost" data-tpl-clone="${escapeHtml(tpl.templateId)}">${micon('content_copy')}คัดลอก</button>
            </div>
          </div>`;
      };
      const body = `
        <section class="m3-section">
          <h2 class="m3-title">แบบฟอร์มประเมิน</h2>
          <p class="m3-eyebrow">สร้าง/แก้ไขฟอร์มทดลองงาน · ฟอร์มที่ถูกใช้แล้วจะถูกล็อก (🔒) เพื่อความเป็นธรรม — แก้โดยคัดลอกเป็นเวอร์ชันใหม่</p>
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
        } catch (e) { alert(e.message); }
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
        ? JSON.parse(JSON.stringify({ templateId: template.templateId || '', name: template.name || '', level: template.level || 'staff', sections: template.sections || [], ratingBands: template.ratingBands || [] }))
        : { templateId: '', name: '', level: 'staff', sections: [], ratingBands: [] };
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
          else if (t.dataset.attLabel != null) { editor.sections[+t.dataset.attLabel].fields[+t.dataset.j].label = t.value; }
          else if (t.dataset.attDeduct != null) { editor.sections[+t.dataset.attDeduct].fields[+t.dataset.j].deduct = Number(t.value || 0); }
        });
        wrap.addEventListener('click', e => {
          const rm = e.target.closest('[data-sec-remove]');
          if (rm) { editor.sections.splice(+rm.dataset.secRemove, 1); paint(); return; }
          const ca = e.target.closest('[data-comp-add]');
          if (ca) { const i = +ca.dataset.compAdd; editor.sections[i].items = editor.sections[i].items || []; editor.sections[i].items.push({ label: '' }); paint(); return; }
          const cr = e.target.closest('[data-comp-remove]');
          if (cr) { editor.sections[+cr.dataset.compRemove].items.splice(+cr.dataset.j, 1); paint(); return; }
        });
        document.querySelectorAll('[data-add-sec]').forEach(b => b.addEventListener('click', () => { editor.sections.push(newTemplateSection(b.dataset.addSec)); paint(); }));
        document.getElementById('tplSave').addEventListener('click', save);
        const del = document.getElementById('tplDelete');
        if (del) del.addEventListener('click', remove);
      }

      async function save() {
        const sum = scoredSum();
        if (!editor.name.trim()) { alert('กรุณาตั้งชื่อแบบฟอร์ม'); return; }
        if (sum !== 100) { alert(`น้ำหนักรวม KPI + Competency + Attendance ต้องเท่ากับ 100 (ตอนนี้ ${sum})`); return; }
        // locked template → save as a brand-new version (clone) so existing evaluations stay fair
        const saveId = isLocked ? '' : editor.templateId;
        try {
          await api('/saveProbationTemplate', { templateId: saveId, name: editor.name, level: editor.level, sections: editor.sections, ratingBands: editor.ratingBands });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          alert('บันทึกแบบฟอร์มแล้ว');
          renderTemplateList(fresh);
        } catch (error) { alert(error.message); }
      }

      async function remove() {
        if (!confirm('ย้ายแบบฟอร์มนี้ไปถังขยะ? (กู้คืนได้ภายหลังจากหน้ารายการแบบฟอร์ม)')) return;
        try {
          await api('/deleteProbationTemplate', { templateId: editor.templateId, active: 0 });
          adminCache = null;
          const fresh = await api('/adminData');
          adminCache = fresh;
          renderTemplateList(fresh);
        } catch (error) { alert(error.message); }
      }

      render(m3Shell('probation', `<div id="tplEditor"></div>`, { bar: { title: editor.templateId ? 'แก้ไขแบบฟอร์ม' : 'สร้างแบบฟอร์ม', back: true } }));
      wireM3Nav({ back: () => renderTemplateList(data) });
      paint();
    }

    /* ===================================================================
       MENTEE / MENTOR PORTAL (Material 3)  — Step 4
       =================================================================== */
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
              <div class="m3-staff-name" style="font-size:15px">${escapeHtml(task.title || task.taskType)}</div>
              <div class="m3-list-sub">${escapeHtml(task.taskType)} · ครบกำหนด ${formatThaiDate(task.dueDate)}</div>
            </div>
            <span class="m3-badge ${done ? 'm3-badge--ok' : 'm3-badge--warn'}">${done ? 'เสร็จ' : 'รอทำ'}</span>
          </div>
        </button>`;
    }

    function menteeHomeTab(user, tasks, meta) {
      const prog = portalProgress(meta, tasks);
      const pending = tasks.filter(t => t.status !== 'Completed');
      const mentor = meta.mentor;
      const nextSession = tasks.filter(t => t.sessionDate).sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)))[0];
      return `
        <section class="m3-hero"><div class="eb">เส้นทางพนักงานใหม่</div><h2>สวัสดี, ${escapeHtml(user.name || user.displayName || '')}</h2><p>ดูงานที่ต้องทำและความคืบหน้าของคุณ</p></section>
        <section class="m3-prog-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px"><div><div class="m3-progress-cap">ความคืบหน้า</div><div class="m3-prog-big">${prog.percent}%</div></div><div class="m3-staff-role">${prog.completed}/${prog.total} งาน</div></div>
          <div class="m3-progress"><div class="m3-progress-bar" style="width:${prog.percent}%"></div></div>
        </section>
        ${nextSession ? `
        <section class="m3-section"><h3 class="m3-section-label">เซสชันที่จะถึง</h3>
          <div class="m3-session"><div class="m3-date-block"><span class="m3-date-day">${dateDayMonth(nextSession.sessionDate).day}</span><span class="m3-date-mon">${dateDayMonth(nextSession.sessionDate).mon}</span></div>
          <div class="m3-session-body"><p class="m3-session-title">${escapeHtml(nextSession.title || 'เซสชัน')}</p><div class="m3-session-meta"><span>${micon('schedule')}${escapeHtml(nextSession.startTime || '-')}</span>${nextSession.room ? `<span>${micon('location_on')}${escapeHtml(nextSession.room)}</span>` : ''}</div></div></div>
        </section>` : ''}
        <section class="m3-section"><div class="m3-section-head"><h3 class="m3-section-label">งานที่ต้องทำ</h3><a class="m3-link" data-ptab="tasks">ดูทั้งหมด</a></div>
          ${pending.length ? pending.slice(0, 3).map(m3TaskCard).join('') : '<div class="m3-empty">ไม่มีงานค้าง 🎉</div>'}
        </section>
        <section class="m3-section"><h3 class="m3-section-label">Mentor ของคุณ</h3>
          <div class="m3-card m3-card-pad" style="display:flex;align-items:center;gap:12px"><div class="m3-list-icon">${micon('person_pin')}</div><div><div class="m3-staff-name" style="font-size:15px">${escapeHtml(mentor && mentor.name ? mentor.name : 'ยังไม่กำหนด')}</div><div class="m3-staff-role">${escapeHtml((mentor && mentor.department) || 'Mentor ประจำรอบ')}</div></div></div>
        </section>`;
    }

    function mentorHomeTab(user, tasks, meta) {
      const mentees = meta.mentees || [];
      const pendingFeedback = tasks.filter(t => t.taskType === 'Feedback' && t.status !== 'Completed');
      return `
        <section class="m3-hero"><div class="eb">Mentor</div><h2>สวัสดี, ${escapeHtml(user.name || user.displayName || '')}</h2><p>ดูแลน้องและให้ Feedback ได้ในที่เดียว</p></section>
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
        <div class="m3-timeline">
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
        <section class="m3-section">${tasks.length ? tasks.map(m3TaskCard).join('') : '<div class="m3-empty">ยังไม่มีงาน</div>'}</section>`;
    }

    function mentorMenteesTab(meta) {
      const mentees = meta.mentees || [];
      return `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">ทีมที่ดูแล</h2></section>
        <section class="m3-section">${mentees.length ? mentees.map(menteeMiniCard).join('') : '<div class="m3-empty">ยังไม่มี mentee ที่ได้รับมอบหมาย</div>'}</section>`;
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
        </section>`;
    }

    function renderUserPortal(user, tasks, options = {}) {
      currentUser = user;
      currentTasks = tasks || [];
      currentPortalMeta = options.meta || currentPortalMeta || {};
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

      render(`<div class="m3-app m3-fade-up">${m3TopBar({ title: 'Nose Tea' })}<main class="m3-main">${banner}${inner}</main>${m3PortalNav(role, portalTab)}</div>`);

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
      const ba = document.querySelector('[data-back-admin]');
      if (ba) ba.addEventListener('click', renderAdmin);
      const bell = document.querySelector('[data-m3-action="notifications"]');
      if (bell) bell.addEventListener('click', () => renderNotifications());
    }

    function m3ScoreGroup(name, label, current) {
      return `<div style="margin-bottom:14px"><div class="m3-elabel">${escapeHtml(label)}</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">${[2, 4, 6, 8, 10].map(v => `<label class="m3-scorebtn"><input type="radio" name="${name}" value="${v}" ${String(current) === String(v) ? 'checked' : ''}>${v}</label>`).join('')}</div></div>`;
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
        <section class="m3-section" style="gap:4px"><h2 class="m3-title" style="font-size:22px">${escapeHtml(task.title || 'งานของคุณ')}</h2><p class="m3-eyebrow">${escapeHtml(task.taskType)} · ครบกำหนด ${formatThaiDate(task.dueDate)}</p></section>
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
        if (isPreview) { alert('โหมด Preview: ฟอร์มนี้ยังไม่บันทึกจริง'); return; }
        const submission = collect();
        if (task.taskType === 'Reflection' && (!submission.learnings || !submission.challenges || !submission.suggestion)) { alert('กรุณากรอกข้อมูลให้ครบ'); return; }
        if (task.taskType === 'Feedback' && ['understanding', 'participation', 'communication', 'adaptability', 'responsibility'].some(k => !submission[k])) { alert('กรุณาให้คะแนนครบทุกข้อ'); return; }
        const button = document.getElementById('m3TaskSubmit');
        button.disabled = true; button.textContent = 'กำลังส่ง...';
        try {
          await api('/submitTask', { taskId: task.taskId, submission });
          try { localStorage.removeItem(localKey); } catch (e) {}
          const portal = await api('/getPortal');
          alert('บันทึกสำเร็จ');
          renderUserPortal(portal.user, portal.tasks || [], { meta: portal });
        } catch (e) { alert(e.message); button.disabled = false; button.textContent = 'ส่งข้อมูล'; }
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
          <button type="button" class="m3-btn m3-btn--ghost" data-m3-tools>${micon('build')}เครื่องมือเดิม (สำรอง)</button>
          ${webSessionToken && !isLineBrowser() ? '<button type="button" class="m3-btn m3-btn--outline" data-m3-logout>ออกจากระบบ</button>' : ''}
        </section>
        <section class="m3-section">
          <h3 class="m3-section-label">เครื่องมือทดสอบ / ดูตัวอย่าง</h3>
          <div class="m3-card m3-card-pad" style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:10px">
              <button type="button" class="m3-btn m3-btn--ghost" data-prev="Mentor" style="flex:1">ดูมุม Mentor</button>
              <button type="button" class="m3-btn m3-btn--ghost" data-prev="Mentee" style="flex:1">ดูมุม Mentee</button>
            </div>
            <button type="button" class="m3-btn m3-btn--ghost" data-health>${micon('monitor_heart')}ตรวจสถานะ API</button>
            <p class="m3-save-hint" id="profHealth" style="text-align:left"></p>
          </div>
        </section>
      `;
      render(m3Shell('profile', body, { bar: { title: 'โปรไฟล์' } }));
      wireM3Nav();
      const manage = document.querySelector('[data-m3-manage]');
      if (manage) manage.addEventListener('click', () => renderManageHub());
      const tools = document.querySelector('[data-m3-tools]');
      if (tools) tools.addEventListener('click', () => renderAdmin());
      const logout = document.querySelector('[data-m3-logout]');
      if (logout) logout.addEventListener('click', logoutWebAdmin);
      document.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click', () => previewAs(b.dataset.prev)));
      const health = document.querySelector('[data-health]');
      if (health) health.addEventListener('click', async () => {
        const out = document.getElementById('profHealth');
        out.textContent = 'กำลังตรวจสอบ...';
        try { const r = await fetch(`${API_BASE}/health`); const t = await r.text(); out.textContent = `API ปกติ: ${t}`; }
        catch (e) { out.textContent = `เชื่อมต่อ API ไม่ได้: ${e.message}`; }
      });
    }

    /* ===================================================================
       HR MANAGEMENT (M3) — migrating classic admin tabs
       =================================================================== */
    function openClassicTab(tab) { adminActiveTab = tab; renderAdmin(); }

    function renderManageHub() {
      const items = [
        ['master', 'badge', 'Master Data พนักงาน', 'นำเข้า/แก้ไขข้อมูลพนักงาน', true],
        ['users', 'manage_accounts', 'ผู้ใช้และสิทธิ์', 'แก้ Role, แผนก, การผูก LINE', true],
        ['groups', 'group_work', 'กลุ่ม Onboarding', 'สร้างกลุ่ม + มอบหมาย mentor/mentee', true],
        ['sessions', 'event', 'Session / รอบงาน', 'สร้างและจัดการเซสชัน', true],
        ['messages', 'forum', 'ส่งข้อความ LINE', 'ส่งรายคน/กลุ่ม + automation', true],
        ['templates', 'description', 'คลังข้อความ', 'Template ข้อความ LINE', true],
        ['audit', 'history', 'ประวัติการแก้ไข (Audit)', 'เฉพาะเจ้าของระบบ', true]
      ].filter(it => it[0] !== 'audit' || (adminCache && adminCache.isOwner));
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
                <div style="flex:1;min-width:0"><div class="m3-staff-name" style="font-size:15px">${escapeHtml(title)}</div><div class="m3-list-sub">${escapeHtml(sub)}</div></div>
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
        else if (k === 'audit') { const d = adminCache || await api('/adminData'); adminCache = d; renderAuditLog(d); }
        else openClassicTab(k);
      }));
    }

    function empCard(e) {
      const search = `${e.employeeName || ''} ${e.employeeCode || ''} ${e.department || ''} ${e.branch || ''}`.toLowerCase();
      const linked = Boolean(e.userId);
      return `
        <div class="m3-staff" data-emp-card="${escapeHtml(e.employeeId)}" data-search="${escapeHtml(search)}">
          <div class="m3-staff-head" style="margin-bottom:10px">
            <div class="m3-staff-id"><div class="m3-avatar">${escapeHtml(initials(e.employeeName))}</div><div><div class="m3-staff-name">${escapeHtml(e.employeeName || '-')}</div><div class="m3-staff-role">${escapeHtml(e.employeeCode || '-')} · ${escapeHtml(e.department || '-')}${e.branch ? ' · ' + escapeHtml(e.branch) : ''}</div></div></div>
            <span class="m3-badge ${linked ? 'm3-badge--ok' : 'm3-badge--warn'}">${linked ? 'ผูก LINE' : 'รอผูก'}</span>
          </div>
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
            <div class="m3-search">${micon('search')}<input id="empSearch" placeholder="ค้นหาชื่อ รหัส หรือแผนก"></div>
            <div style="display:flex;gap:10px">
              <button type="button" class="m3-btn m3-btn--tonal" data-emp-import>${micon('upload_file')}นำเข้า CSV</button>
              <button type="button" class="m3-btn" data-emp-add>${micon('person_add')}เพิ่ม</button>
            </div>
          </section>
          <section class="m3-section" id="empList">${emps.map(empCard).join('') || '<div class="m3-empty">ยังไม่มีพนักงาน</div>'}</section>
        `;
        render(m3Shell('onboarding', body, { bar: { title: 'Master Data', back: true } }));
        wireM3Nav({ back: () => renderManageHub() });
        const s = document.getElementById('empSearch');
        s.addEventListener('input', () => { const k = s.value.trim().toLowerCase(); document.querySelectorAll('[data-emp-card]').forEach(c => { c.style.display = !k || c.dataset.search.includes(k) ? '' : 'none'; }); });
        document.querySelector('[data-emp-add]').addEventListener('click', () => renderEmployeeEditorM3(null));
        document.querySelector('[data-emp-import]').addEventListener('click', () => renderEmployeeImportM3());
        document.querySelectorAll('[data-emp-edit]').forEach(b => b.addEventListener('click', () => renderEmployeeEditorM3(emps.find(e => e.employeeId === b.dataset.empEdit))));
        document.querySelectorAll('[data-emp-unlink]').forEach(b => b.addEventListener('click', async () => {
          if (!confirm('ยกเลิกการผูก LINE ของพนักงานคนนี้?')) return;
          try { await api('/adminUnlinkEmployee', { employeeId: b.dataset.empUnlink, reason: 'admin_ui' }); adminCache = null; renderEmployeesM3(); } catch (e) { alert(e.message); }
        }));
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    function renderEmployeeEditorM3(emp) {
      const e = emp || {};
      const body = `
        <section class="m3-section">
          <h2 class="m3-title" style="font-size:22px">${e.employeeId ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</h2>
          <form id="empForm">
            <input type="hidden" name="employeeId" value="${escapeHtml(e.employeeId || '')}">
            <label class="m3-elabel">รหัสพนักงาน</label><input class="m3-input" name="employeeCode" required value="${escapeHtml(e.employeeCode || '')}" placeholder="เช่น NT001">
            <label class="m3-elabel">ชื่อ-นามสกุล</label><input class="m3-input" name="employeeName" required value="${escapeHtml(e.employeeName || '')}">
            <label class="m3-elabel">แผนก</label><input class="m3-input" name="department" value="${escapeHtml(e.department || '')}">
            <label class="m3-elabel">ตำแหน่ง</label><input class="m3-input" name="position" value="${escapeHtml(e.position || '')}">
            <label class="m3-elabel">สาขา</label><input class="m3-input" name="branch" value="${escapeHtml(e.branch || '')}">
            <label class="m3-elabel">วันเริ่มงาน</label><input class="m3-input" type="date" name="startDate" value="${escapeHtml(e.startDate || '')}">
            <label class="m3-elabel">สถานะการจ้าง</label>
            <select class="m3-select" name="employmentStatus">${['active', 'probation', 'inactive', 'resigned'].map(s => `<option value="${s}" ${s === (e.employmentStatus || 'active') ? 'selected' : ''}>${s}</option>`).join('')}</select>
            <label class="m3-elabel">ทดลองงาน</label>
            <select class="m3-select" name="probationRequired"><option value="0" ${e.probationRequired ? '' : 'selected'}>ไม่ต้องประเมิน</option><option value="1" ${e.probationRequired ? 'selected' : ''}>ต้องประเมิน</option></select>
            <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}บันทึก</button>
          </form>
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('onboarding', body, { bar: { title: e.employeeId ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderEmployeesM3() });
      document.getElementById('empForm').addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await api('/adminUpsertEmployee', Object.fromEntries(new FormData(event.currentTarget).entries()));
          adminCache = null;
          renderEmployeesM3();
        } catch (err) { alert(err.message); }
      });
    }

    function renderEmployeeImportM3() {
      const body = `
        <section class="m3-section">
          <h2 class="m3-title" style="font-size:22px">นำเข้าพนักงาน (CSV)</h2>
          <div class="m3-empty" style="text-align:left">หัวข้อที่รองรับ: <strong>employee_code, employee_name, department, position, branch, start_date, employment_status, probation_required</strong><br>start_date รูปแบบ YYYY-MM-DD</div>
          <form id="impForm">
            <label class="m3-elabel">เลือกไฟล์ CSV</label><input class="m3-input" id="impFile" type="file" accept=".csv,text/csv">
            <label class="m3-elabel">หรือวาง CSV</label><textarea class="m3-textarea" name="csvText" placeholder="employee_code,employee_name,department,...&#10;NT001,สมชาย ใจดี,Operations,..."></textarea>
            <input type="hidden" name="fileName">
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
          alert(`นำเข้าแล้ว: เพิ่มใหม่ ${r.newRows} คน · มีอยู่แล้ว (ข้าม) ${r.skippedRows} · ผิดพลาด ${r.errorRows}`);
          renderEmployeesM3();
        } catch (err) { alert(err.message); }
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
            <div class="m3-search">${micon('search')}<input id="usrSearch" placeholder="ค้นหาชื่อ อีเมล หรือแผนก"></div>
          </section>
          <section class="m3-section">
            ${users.map(u => {
              const search = `${u.name || ''} ${u.email || ''} ${u.department || ''} ${u.role || ''}`.toLowerCase();
              return `
                <button type="button" class="m3-task-btn m3-pressable" data-usr-edit="${escapeHtml(u.userId)}" data-search="${escapeHtml(search)}">
                  <div style="display:flex;gap:12px;align-items:center">
                    <div class="m3-avatar">${escapeHtml(initials(u.name || u.displayName))}</div>
                    <div style="flex:1;min-width:0"><div class="m3-staff-name" style="font-size:15px">${escapeHtml(u.name || u.displayName || '-')}</div><div class="m3-list-sub">${escapeHtml(u.department || '-')} · ${u.lineUserId ? 'ผูก LINE' : 'ยังไม่ผูก'}</div></div>
                    <span class="m3-badge ${roleBadge[u.role] || ''}">${escapeHtml(u.role || '-')}</span>
                  </div>
                </button>`;
            }).join('') || '<div class="m3-empty">ยังไม่มีผู้ใช้</div>'}
          </section>
        `;
        render(m3Shell('profile', body, { bar: { title: 'ผู้ใช้และสิทธิ์', back: true } }));
        wireM3Nav({ back: () => renderManageHub() });
        const s = document.getElementById('usrSearch');
        s.addEventListener('input', () => { const k = s.value.trim().toLowerCase(); document.querySelectorAll('[data-usr-edit]').forEach(c => { c.style.display = !k || c.dataset.search.includes(k) ? '' : 'none'; }); });
        document.querySelectorAll('[data-usr-edit]').forEach(b => b.addEventListener('click', () => renderUserEditorM3(users.find(u => u.userId === b.dataset.usrEdit))));
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    function renderUserEditorM3(user) {
      if (!user) { renderUsersM3(); return; }
      const body = `
        <section class="m3-section">
          <h2 class="m3-title" style="font-size:22px">แก้ไขผู้ใช้</h2>
          <form id="usrForm">
            <input type="hidden" name="userId" value="${escapeHtml(user.userId)}">
            <label class="m3-elabel">Role</label>
            <select class="m3-select" name="role">${['HR', 'Mentor', 'Mentee'].map(r => `<option value="${r}" ${user.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
            <label class="m3-elabel">ชื่อ</label><input class="m3-input" name="name" required value="${escapeHtml(user.name || user.displayName || '')}">
            <label class="m3-elabel">แผนก</label><input class="m3-input" name="department" required value="${escapeHtml(user.department || '')}">
            <label class="m3-elabel">ตำแหน่ง</label><input class="m3-input" name="position" value="${escapeHtml(user.position || '')}">
            <label class="m3-elabel">อีเมล</label><input class="m3-input" type="email" name="email" required value="${escapeHtml(user.email || '')}">
            <label class="m3-elabel">สถานะ</label>
            <select class="m3-select" name="active"><option value="1" ${user.active ? 'selected' : ''}>ใช้งาน</option><option value="0" ${!user.active ? 'selected' : ''}>ปิดใช้งาน</option></select>
            <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}บันทึก</button>
          </form>
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('profile', body, { bar: { title: 'แก้ไขผู้ใช้', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderUsersM3() });
      document.getElementById('usrForm').addEventListener('submit', async event => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        payload.active = payload.active === '1';
        try { await api('/adminUpdateUser', payload); adminCache = null; renderUsersM3(); } catch (err) { alert(err.message); }
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
      } catch (e) { render(m3ErrorScreen(e.message)); }
    }

    function renderGroupEditorM3() {
      const body = `
        <section class="m3-section">
          <h2 class="m3-title" style="font-size:22px">สร้างกลุ่ม Onboarding</h2>
          <form id="grpForm">
            <label class="m3-elabel">ชื่อกลุ่ม</label><input class="m3-input" name="groupName" required placeholder="เช่น OB มิถุนายน รุ่น 4">
            <label class="m3-elabel">วันเริ่ม</label><input class="m3-input" type="date" name="startDate" required>
            <label class="m3-elabel">ระยะห่างแต่ละรอบ (วัน)</label><input class="m3-input" type="number" name="intervalDays" value="30" min="1">
            <label class="m3-elabel">จำนวนเดือน</label><input class="m3-input" type="number" name="totalMonths" value="4" min="1">
            <button type="submit" class="m3-btn" style="margin-top:16px">${micon('save')}สร้างกลุ่ม</button>
          </form>
          <div style="height:30px"></div>
        </section>
      `;
      render(m3Shell('onboarding', body, { bar: { title: 'สร้างกลุ่ม', back: true }, noNav: true }));
      wireM3Nav({ back: () => renderGroupsM3() });
      document.getElementById('grpForm').addEventListener('submit', async event => {
        event.preventDefault();
        try { await api('/createOnboardingGroup', Object.fromEntries(new FormData(event.currentTarget).entries())); adminCache = null; renderGroupsM3(); } catch (err) { alert(err.message); }
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
          <h2 class="m3-title" style="font-size:22px">สมาชิก: ${escapeHtml(group.groupName)}</h2>
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
          alert(`บันทึกแล้ว · mentor ${r.activeMentors || 0} · mentee ${r.activeMentees || 0} · สร้างงาน ${r.createdTasks || 0} · อัปเดต ${r.updatedTasks || 0}`);
          renderGroupsM3();
        } catch (err) { alert(err.message); }
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
          <h2 class="m3-title" style="font-size:22px">${s.checkpointId ? 'แก้ไข Session' : 'สร้าง Session'}</h2>
          <form id="sesForm">
            <input type="hidden" name="checkpointId" value="${escapeHtml(s.checkpointId || '')}">
            <label class="m3-elabel">กลุ่ม</label>
            <select class="m3-select" name="groupId"><option value="">ทุกคน (fallback)</option>${groups.map(g => `<option value="${escapeHtml(g.groupId)}" ${(s.groupId || presetGroupId) === g.groupId ? 'selected' : ''}>${escapeHtml(g.groupName)}</option>`).join('')}</select>
            <label class="m3-elabel">เดือนที่</label><input class="m3-input" type="number" name="monthNo" min="1" value="${escapeHtml(s.monthNo || 1)}">
            <label class="m3-elabel">ชื่อ Session</label><input class="m3-input" name="checkpointName" required value="${escapeHtml(s.checkpointName || '')}" placeholder="เช่น Month 1 - ปฐมนิเทศ">
            <label class="m3-elabel">วันที่</label><input class="m3-input" type="date" name="sessionDate" required value="${escapeHtml(s.sessionDate || '')}">
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
      document.getElementById('sesForm').addEventListener('submit', async event => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
          const r = await api(payload.checkpointId ? '/updateCheckpoint' : '/createCheckpoint', payload);
          adminCache = null;
          if (!payload.checkpointId) alert(`สร้าง session แล้ว · งานใหม่ ${r.createdTasks || 0} · อัปเดต ${r.updatedTasks || 0}`);
          renderSessionsM3();
        } catch (err) { alert(err.message); }
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
          else alert('ผู้รับที่เลือกยังไม่ได้ผูกบัญชี LINE จึงส่งข้อความหาไม่ได้');
          pendingMessageUserId = '';
        }
        filterTasks();
        msgForm.addEventListener('submit', async event => {
          event.preventDefault();
          try { await api('/sendLineMessage', Object.fromEntries(new FormData(event.currentTarget).entries())); alert('ส่งแล้ว'); } catch (e) { alert(e.message); }
        });

        const segForm = document.getElementById('segForm');
        const segTpl = document.getElementById('segTpl');
        segTpl.addEventListener('change', () => { const t = (data.templates || []).find(x => x.templateId === segTpl.value); if (t) segForm.message.value = t.body || segForm.message.value; });
        segForm.addEventListener('submit', async event => {
          event.preventDefault();
          try { const r = await api('/sendSegmentLine', Object.fromEntries(new FormData(event.currentTarget).entries())); alert(`ส่งสำเร็จ ${r.sent} · ล้มเหลว ${r.failed}`); } catch (e) { alert(e.message); }
        });

        const out = document.getElementById('autoResult');
        document.getElementById('btnSync').addEventListener('click', async event => {
          const b = event.currentTarget; b.disabled = true;
          try { const r = await api('/syncGroupLifecycle'); out.textContent = `Sync: checkpoint ${r.createdCheckpoints} · งานใหม่ ${r.createdTasks} · อัปเดต ${r.updatedTasks}`; adminCache = null; } catch (e) { alert(e.message); } finally { b.disabled = false; }
        });
        document.getElementById('btnRunDaily').addEventListener('click', async event => {
          const b = event.currentTarget; b.disabled = true;
          try { const r = await api('/runDailyAutomation'); out.textContent = `ตรวจ ${r.candidates || 0} งาน · เลือก ${r.selected || 0} · ส่ง ${r.sent || 0} · ล้มเหลว ${r.failed || 0}`; } catch (e) { alert(e.message); } finally { b.disabled = false; }
        });
        document.getElementById('btnAnnounce').addEventListener('click', async event => {
          const b = event.currentTarget; b.disabled = true;
          try { const r = await api('/runSessionAnnouncements'); out.textContent = `ประกาศ session: แจ้ง ${r.sessionsNotified || 0} รอบ · ส่ง ${r.sent || 0} · ล้มเหลว ${r.failed || 0}`; } catch (e) { alert(e.message); } finally { b.disabled = false; }
        });
        document.getElementById('btnPreviewCard').addEventListener('click', async event => {
          const b = event.currentTarget; b.disabled = true;
          try { await api('/sendPreviewFlex', { role: 'Mentor' }); out.textContent = 'ส่งการ์ดตัวอย่างเข้า LINE ของคุณแล้ว (เช็คในแชท)'; } catch (e) { alert(e.message); } finally { b.disabled = false; }
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
          <h2 class="m3-title" style="font-size:22px">${t.templateId ? 'แก้ไข Template' : 'สร้าง Template'}</h2>
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
        try { await api('/upsertMessageTemplate', payload); adminCache = null; renderMsgTemplatesM3(); } catch (err) { alert(err.message); }
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
        <div class="m3-staff m3-pressable" data-ob-card="${escapeHtml(staff.userId)}" data-status="${key}" data-search="${escapeHtml(search)}">
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

    async function renderOnboardingList() {
      render(m3Loading('Onboarding'));
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser || currentUser;
        const staff = buildOnboardingStaff(data);
        const body = `
          <section class="m3-section">
            <h2 class="m3-title">Onboarding</h2>
            <div class="m3-search">${micon('search')}<input id="obSearch" placeholder="ค้นหาชื่อ ตำแหน่ง หรือสาขา"></div>
            <div class="m3-filterbar">
              <button type="button" class="m3-filter active" data-ob-filter="all">ทั้งหมด</button>
              <button type="button" class="m3-filter" data-ob-filter="active">กำลังดำเนิน</button>
              <button type="button" class="m3-filter" data-ob-filter="pending">รอเริ่ม</button>
              <button type="button" class="m3-filter" data-ob-filter="done">เสร็จสิ้น</button>
            </div>
          </section>
          <section class="m3-section" id="obList">
            ${staff.length ? staff.map(onboardingStaffCard).join('') : '<div class="m3-empty">ยังไม่มีพนักงานในรอบ onboarding<br>สร้างกลุ่มและ assign สมาชิกก่อน (ปุ่ม + ด้านล่าง)</div>'}
          </section>
        `;
        render(m3Shell('onboarding', body, { bar: { title: 'Onboarding' }, fab: { icon: 'group_add', action: 'new-group', label: 'จัดการกลุ่ม' } }));
        wireM3Nav();
        const search = document.getElementById('obSearch');
        let activeFilter = 'all';
        const apply = () => {
          const keyword = (search.value || '').trim().toLowerCase();
          document.querySelectorAll('[data-ob-card]').forEach(card => {
            const matchKw = !keyword || card.dataset.search.includes(keyword);
            const matchFilter = activeFilter === 'all' || card.dataset.status === activeFilter;
            card.style.display = matchKw && matchFilter ? '' : 'none';
          });
        };
        search.addEventListener('input', apply);
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
          <div class="m3-tl-card ${cardCls}">
            <div>
              <div class="m3-tl-title">${escapeHtml(task.title || task.taskType)}</div>
              <div class="m3-tl-sub">${escapeHtml(task.taskType || '')} · ครบกำหนด ${formatThaiDate(task.dueDate)}</div>
            </div>
            ${badge}
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
            <div><p class="m3-progress-cap">ความคืบหน้ารวม</p><p class="m3-title" style="font-size:22px">${staff.percent}% เสร็จสิ้น</p></div>
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
              <div class="m3-staff-name" style="font-size:15px">${escapeHtml(staff.mentorName || 'ยังไม่กำหนด')}</div>
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
      if (edit) edit.addEventListener('click', () => { adminActiveTab = 'employees'; renderAdmin(); });
      const goProb = document.querySelector('[data-ob-goprob]');
      if (goProb && isProbation) goProb.addEventListener('click', () => {
        if (staff.employeeId) renderProbationDetail(staff.employeeId, data);
        else renderProbationHome();
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
      webSessionToken = result.token;
      localStorage.setItem('noseTeaWebSession', webSessionToken);
      currentUser = result.user;
      window.history.replaceState({}, document.title, webRedirectUri());
      renderHrHome();
    }

    function logoutWebAdmin() {
      webSessionToken = '';
      localStorage.removeItem('noseTeaWebSession');
      adminCache = null;
      currentUser = null;
      renderWebFallback();
    }

    function renderWebFallback() {
      render(`
        <div class="m3-app m3-fade-up">
          <main class="m3-main" style="min-height:100vh;align-items:center;justify-content:center;text-align:center;gap:24px;padding-top:72px;padding-bottom:72px">
            <div class="m3-load-logo" style="animation:none;width:88px;height:88px;font-size:18px">
              <img class="m3-brand-img" src="/assets/logo.png?v=20260619-22" alt="Nose Tea" onerror="this.remove()"><span class="m3-brand-txt">Nose<br>Tea</span>
            </div>
            <div>
              <h1 class="m3-title">Nose Tea HR Portal</h1>
              <p class="m3-eyebrow" style="margin-top:6px">เข้าสู่ระบบสำหรับ HR / Admin</p>
            </div>
            <div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:12px">
              <button type="button" class="m3-btn" id="webAdminLogin">${micon('login')}เข้าสู่ระบบด้วย LINE</button>
              <a class="m3-btn m3-btn--ghost" href="https://liff.line.me/2010372532-0i3JE94q" style="text-decoration:none">${micon('badge')}พนักงาน: เปิดผ่าน LINE</a>
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
        throw new Error(data.error || 'Request failed');
      }
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

    function topbar(user, label = '') {
      const display = user && (user.name || user.displayName) ? user.name || user.displayName : 'Nose Tea';
      const role = user && user.role ? user.role : 'Guest';
      return `
        <header class="topbar">
          <div class="topbar-inner">
            <div class="brand">
              <div class="brand-logo">Nose<br>Tea</div>
              <div>
                <h2>Onboarding Journey</h2>
                <div class="muted" style="color:rgba(255,255,255,.72)">LINE LIFF + Cloudflare D1</div>
              </div>
            </div>
            <div class="role-chip">${escapeHtml(label || role)} · ${escapeHtml(display)}</div>
            ${webSessionToken && !isLineBrowser() ? '<button type="button" class="secondary" id="webLogout" style="width:auto;margin:0;min-height:38px">Logout Web</button>' : ''}
          </div>
        </header>
      `;
    }

    function renderRegister() {
      const name = lineProfile && lineProfile.displayName ? lineProfile.displayName : '';
      render(shell('ลงทะเบียนเข้าใช้งาน', `
        <div class="success">
          <strong>ยืนยัน LINE สำเร็จ</strong><br>
          ชื่อใน LINE: ${escapeHtml(name)}
        </div>
        <form id="registerForm">
          <label>Role</label>
          <select name="role" required>
            <option value="Mentor">Mentor</option>
            <option value="Mentee">Mentee</option>
          </select>

          <label>ชื่อ-นามสกุล</label>
          <input name="name" required value="${escapeHtml(name)}" placeholder="เช่น Kitti P.">

          <label>แผนก</label>
          <input name="department" required placeholder="เช่น Operations, Marketing, HR">

          <label>ตำแหน่ง</label>
          <input name="position" placeholder="เช่น Store Manager">

          <label>Employee Code</label>
          <input name="employeeCode" placeholder="ถ้า HR แจ้งไว้ เช่น NT001">
          <p class="muted" style="margin-top:-8px">ถ้ามีรหัสพนักงาน ระบบจะผูกบัญชี LINE กับข้อมูล Employee Master อัตโนมัติ</p>

          <label>Company Email</label>
          <input type="email" name="email" required placeholder="name@nosetea.com">

          <button type="submit">บันทึกและผูกบัญชี LINE</button>
        </form>
      `));

      document.getElementById('registerForm').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button');
        button.disabled = true;
        button.textContent = 'กำลังบันทึก...';
        try {
          const result = await api('/registerUser', Object.fromEntries(new FormData(form).entries()));
          currentUser = result.user;
          renderPortal(result.user, []);
        } catch (error) {
          button.disabled = false;
          button.textContent = 'บันทึกและผูกบัญชี LINE';
          alert(error.message);
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

    async function renderAdmin() {
      render(`${topbar(currentUser)}<main class="app-shell"><section class="panel"><div class="panel-body"><h2>กำลังโหลด Admin Dashboard...</h2></div></section></main>`);
      try {
        const data = adminCache || await api('/adminData');
        adminCache = data;
        currentUser = data.currentUser;
        render(`
          ${topbar(data.currentUser, 'HR Admin')}
          <main class="app-shell">
            <section class="panel">
              <div class="panel-body">
                <h2>Admin Control Center</h2>
                <p class="muted" style="margin-top:4px">จัดการ session, tasks, notifications, templates และ progress ทั้งระบบ</p>
                ${adminNotice ? `
                  <div class="success admin-notice" style="margin-top:14px">
                    <strong>${escapeHtml(adminNotice.title)}</strong>
                    <div style="margin-top:5px">${escapeHtml(adminNotice.body)}</div>
                    ${adminNotice.nextTab ? `<button type="button" class="secondary" data-jump-tab="${escapeHtml(adminNotice.nextTab)}" style="width:auto;margin-top:10px">${escapeHtml(adminNotice.nextLabel || 'ไปขั้นถัดไป')}</button>` : ''}
                  </div>
                ` : ''}
                <div class="wide-actions">
                  <button type="button" id="backHomeM3" class="secondary">← หน้าหลัก</button>
                  <button type="button" id="refreshAdmin" class="secondary">Refresh Data</button>
                </div>
              </div>
            </section>

            <div class="tabs">
              <button class="${adminActiveTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Dashboard</button>
              <button class="${adminActiveTab === 'groups' ? 'active' : ''}" data-tab="groups">Groups</button>
              <button class="${adminActiveTab === 'users' ? 'active' : ''}" data-tab="users">Users</button>
              <button class="${adminActiveTab === 'employees' ? 'active' : ''}" data-tab="employees">Employees</button>
              <button class="${adminActiveTab === 'sessions' ? 'active' : ''}" data-tab="sessions">Sessions</button>
              <button class="${adminActiveTab === 'messages' ? 'active' : ''}" data-tab="messages">LINE Messages</button>
              <button class="${adminActiveTab === 'templates' ? 'active' : ''}" data-tab="templates">Templates</button>
              <button class="${adminActiveTab === 'more' ? 'active' : ''}" data-tab="more">More</button>
            </div>
            <div id="adminPanel"></div>
          </main>
        `);

        const logoutButton = document.getElementById('webLogout');
        if (logoutButton) logoutButton.addEventListener('click', logoutWebAdmin);
        const backHome = document.getElementById('backHomeM3');
        if (backHome) backHome.addEventListener('click', renderHrHome);
        document.getElementById('refreshAdmin').addEventListener('click', () => {
          adminCache = null;
          renderAdmin();
        });
        document.querySelectorAll('[data-tab]').forEach(button => {
          button.addEventListener('click', () => {
            document.querySelectorAll('[data-tab]').forEach(item => item.classList.remove('active'));
            button.classList.add('active');
            adminActiveTab = button.dataset.tab;
            renderAdminTab(button.dataset.tab, data);
          });
        });
        renderAdminTab(adminActiveTab, data);
      } catch (error) {
        render(`${topbar(currentUser)}<main class="app-shell"><section class="panel"><div class="panel-body"><div class="error">${escapeHtml(error.message)}</div></div></section></main>`);
      }
    }

    async function sendPreviewFlex(role) {
      try {
        await api('/sendPreviewFlex', { role });
        alert(`ส่งการ์ด ${role} เข้า LINE ของคุณแล้ว`);
      } catch (error) {
        alert(error.message);
      }
    }

    function renderTaskOwnerName(task, data) {
      const owner = (data.users || []).find(user => user.userId === task.ownerUserId);
      return owner ? (owner.name || owner.displayName || owner.userId) : (task.ownerUserId || '-');
    }

    function renderTaskTargetName(task, data) {
      if (!task.employeeId) return '-';
      const matchedMember = (data.groupMembers || []).find(member => member.role === 'Mentee' && member.groupMemberId && member.userId !== task.ownerUserId);
      if (matchedMember) return matchedMember.name || '-';
      return task.employeeId;
    }

    function renderSessionGroupName(session, data) {
      const group = (data.groups || []).find(item => item.groupId === session.groupId);
      return group ? group.groupName : 'Manual / global';
    }

    function buildWorkflowInbox(data) {
      const groups = new Map((data.groups || []).map(group => [group.groupId, group.groupName]));
      const today = new Date().toISOString().slice(0, 10);
      const buckets = new Map();
      (data.tasks || []).filter(task => task.status !== 'Completed').forEach(task => {
        const moduleName = task.taskType === 'Probation' ? 'Probation' : 'Onboarding';
        const groupName = task.groupId ? (groups.get(task.groupId) || task.groupId) : 'Manual / Global';
        const monthLabel = task.monthNo ? `Month ${task.monthNo}` : 'No round';
        const key = `${moduleName}|${task.groupId || 'global'}|${monthLabel}`;
        if (!buckets.has(key)) {
          buckets.set(key, { moduleName, groupName, monthLabel, tasks: [], overdue: 0, upcoming: 0 });
        }
        const bucket = buckets.get(key);
        bucket.tasks.push(task);
        if (task.dueDate && task.dueDate < today) bucket.overdue += 1;
        else bucket.upcoming += 1;
      });
      return [...buckets.values()]
        .sort((a, b) => (b.overdue - a.overdue) || (b.tasks.length - a.tasks.length))
        .slice(0, 8);
    }

    function renderAdminOverview(data) {
      const summary = data.summary || {};
      const pendingQueue = data.recentQueue || [];
      const workflowInbox = buildWorkflowInbox(data);
      const recentSessions = (data.sessions || []).slice(0, 4);
      return `
        <section class="panel" style="margin-bottom:16px">
          <div class="panel-body">
            <div class="ops-header">
              <div>
                <h2>HR Command Center</h2>
                <p class="muted" style="margin-top:4px">เริ่มจากตรวจรายชื่อและ Role จากนั้นสร้างกลุ่ม สร้างรอบงาน แล้วปล่อยให้ระบบส่ง Flex card ตาม due อัตโนมัติทุกวัน 09:00</p>
              </div>
              <div class="ops-status">Automation ready</div>
            </div>
            <div class="ops-grid" style="margin-top:14px">
              <button type="button" class="ops-card" data-jump-tab="users">
                <span class="ops-step">Step 1</span>
                <strong>ตรวจบัญชี</strong>
                <span>ดูว่าใครลงทะเบียน LINE แล้ว ผูก employee code แล้ว และ Role ถูกต้องไหม</span>
              </button>
              <button type="button" class="ops-card" data-jump-tab="employees">
                <span class="ops-step">Step 1.5</span>
                <strong>Master Data</strong>
                <span>นำเข้า CSV และตรวจสถานะ probation / active ก่อนเริ่มรอบจริง</span>
              </button>
              <button type="button" class="ops-card" data-jump-tab="groups">
                <span class="ops-step">Step 2</span>
                <strong>จัดกลุ่ม OB</strong>
                <span>เลือก mentor หลายคนและ mentee หลายคนเข้ารอบเดียวกัน</span>
              </button>
              <button type="button" class="ops-card" data-jump-tab="sessions">
                <span class="ops-step">Step 3</span>
                <strong>สร้างรอบงาน</strong>
                <span>ตั้งวัน ห้อง และเดือน ระบบจะสร้าง task ให้ตามสมาชิกในกลุ่ม</span>
              </button>
              <button type="button" class="ops-card ops-card-accent" data-jump-tab="messages">
                <span class="ops-step">Step 4</span>
                <strong>ติดตามการส่ง</strong>
                <span>ใช้ส่งซ้ำหรือ override เท่านั้น งานประจำวันให้ automation ส่งเอง</span>
              </button>
            </div>
          </div>
        </section>

        <div class="grid stats">
          <section class="panel stat-panel" data-jump-tab="users"><div class="panel-body"><h3>Total Users</h3><div class="stat-number">${summary.totalUsers || 0}</div><p class="muted">Registered in D1</p></div></section>
          <section class="panel stat-panel" data-jump-tab="employees"><div class="panel-body"><h3>Employees</h3><div class="stat-number">${summary.totalEmployees || 0}</div><p class="muted">${summary.linkedEmployees || 0} linked / ${summary.unlinkedEmployees || 0} waiting</p></div></section>
          <section class="panel stat-panel" data-jump-tab="users"><div class="panel-body"><h3>Mentors</h3><div class="stat-number">${summary.mentors || 0}</div><p class="muted">Active mentor accounts</p></div></section>
          <section class="panel stat-panel" data-jump-tab="users"><div class="panel-body"><h3>Mentees</h3><div class="stat-number">${summary.mentees || 0}</div><p class="muted">Active mentee accounts</p></div></section>
          <section class="panel stat-panel" data-jump-tab="groups"><div class="panel-body"><h3>Groups</h3><div class="stat-number">${summary.activeGroups || 0}</div><p class="muted">Active onboarding groups</p></div></section>
          <section class="panel stat-panel" data-jump-tab="sessions"><div class="panel-body"><h3>Open Sessions</h3><div class="stat-number">${summary.openSessions || 0}</div><p class="muted">Ready for onboarding</p></div></section>
          <section class="panel stat-panel" data-jump-tab="messages"><div class="panel-body"><h3>Pending Tasks</h3><div class="stat-number">${summary.pendingTasks || 0}</div><p class="muted">Need follow-up</p></div></section>
        </div>

        <section class="panel" style="margin-top:16px">
          <div class="panel-body">
            <div class="ops-header">
              <div>
                <h2>Automation Inbox</h2>
                <p class="muted" style="margin-top:4px">ระบบจะส่ง Flex card เองเวลา 09:00 ทุกวันตาม due date: ก่อนครบกำหนด 3 วัน, วันครบกำหนด และเตือนซ้ำทุก 2 วันถ้ายังไม่เสร็จ</p>
              </div>
              <button type="button" id="runDailyAutomation" class="warning">Run 09:00 Automation Now</button>
            </div>
            <div id="runDailyAutomationResult" class="muted" style="margin-top:10px"></div>
            <div class="ops-list" style="margin-top:14px">
              ${workflowInbox.length ? workflowInbox.map(bucket => `
                <details class="ops-list-item workflow-bucket" ${bucket.overdue ? 'open' : ''}>
                  <summary>
                    <div>
                      <strong>${escapeHtml(bucket.moduleName)} · ${escapeHtml(bucket.monthLabel)}</strong>
                      <div class="muted" style="margin-top:4px">${escapeHtml(bucket.groupName)} · ${bucket.tasks.length} pending · overdue ${bucket.overdue}</div>
                    </div>
                    <span class="pill">${bucket.upcoming} upcoming</span>
                  </summary>
                  <div class="workflow-task-list">
                    ${bucket.tasks.slice(0, 8).map(task => `
                      <div class="mini-task-row">
                        <span>${escapeHtml(task.title || task.taskId)}</span>
                        <small>${escapeHtml(task.taskType || 'Task')} · Due ${formatThaiDate(task.dueDate)} · Owner ${escapeHtml(renderTaskOwnerName(task, data))}</small>
                        <button type="button" class="secondary" data-open-task-message="${escapeHtml(task.taskId)}">Send Card</button>
                      </div>
                    `).join('')}
                    ${bucket.tasks.length > 8 ? `<div class="muted">+ ${bucket.tasks.length - 8} more tasks in this bucket</div>` : ''}
                  </div>
                </details>
              `).join('') : '<div class="note">ยังไม่มี pending task ตอนนี้ ถ้าพึ่งจัดกลุ่มให้กด Sync Group Lifecycle หรือสร้าง Session ก่อน</div>'}
            </div>
            <div class="wide-actions" style="margin-top:12px">
              <button type="button" class="secondary" data-jump-tab="messages">เปิด Manual Message Center</button>
              <button type="button" class="secondary" id="syncLifecycleShortcut">Sync Group Lifecycle</button>
            </div>
          </div>
        </section>

        <section class="panel" style="margin-top:16px">
          <div class="panel-body">
            <div class="ops-header">
              <div>
                <h2>Upcoming Sessions</h2>
                <p class="muted" style="margin-top:4px">Edit or review the latest onboarding sessions.</p>
              </div>
              <button type="button" class="secondary" data-jump-tab="sessions">Manage Sessions</button>
            </div>
            <div class="grid" style="margin-top:14px">
              ${recentSessions.length ? recentSessions.map(session => `
                <div class="session-card">
                  <div class="session-head">
                    <div>
                      <span class="pill">MONTH ${escapeHtml(session.monthNo || '1')}</span>
                      <h3 style="margin-top:10px">${escapeHtml(session.checkpointName)}</h3>
                      <div class="muted" style="margin-top:4px">${formatThaiDate(session.sessionDate)} · ${escapeHtml(session.startTime || '-')} - ${escapeHtml(session.endTime || '-')}</div>
                      <div class="muted" style="margin-top:4px">Group: ${escapeHtml(renderSessionGroupName(session, data))}</div>
                    </div>
                    <button type="button" class="secondary" data-edit-session="${escapeHtml(session.checkpointId)}" style="width:auto;min-height:36px">Edit</button>
                  </div>
                </div>
              `).join('') : '<div class="note">No session yet. Create one from the Sessions tab.</div>'}
            </div>
          </div>
        </section>

        <section class="panel" style="margin-top:16px">
          <div class="panel-body">
            <div class="ops-header">
              <div>
                <h2>Lifecycle Automation</h2>
                <p class="muted" style="margin-top:4px">Sync month-based checkpoints and tasks from every active onboarding group before sending reminders.</p>
              </div>
              <button type="button" id="syncLifecycle" class="warning">Sync Group Lifecycle</button>
            </div>
            <div id="syncLifecycleResult" class="muted" style="margin-top:10px"></div>
            <h3 style="margin-top:18px">Force Action Controller</h3>
            <p class="muted" style="margin-top:4px">Create real tasks immediately for testing or manual intervention.</p>
            <form id="forceTaskForm" class="grid" style="margin-top:14px">
              <label>Onboarding Group</label>
              <select name="groupId">
                <option value="">All active users</option>
                ${(data.groups || []).map(group => `<option value="${escapeHtml(group.groupId)}">${escapeHtml(group.groupName)}</option>`).join('')}
              </select>
              <label>Month No</label>
              <input name="monthNo" type="number" min="1" value="1">
              <label>Task Type</label>
              <select name="taskType">
                <option value="Feedback">Force Feedbacks to Mentors</option>
                <option value="Reflection">Force Reflections to Mentees</option>
                <option value="Attendance">Force Attendance to Mentees</option>
              </select>
              <label>Task Title</label>
              <input name="title" required placeholder="Task title" value="Month 1 Onboarding Task">
              <label>Due Date</label>
              <input name="dueDate" type="date">
              <label>Description</label>
              <textarea name="description" placeholder="Task description">Please complete this onboarding task.</textarea>
              <button type="submit">Create Force Tasks</button>
            </form>
          </div>
        </section>
      `;
    }

    function renderUserEditor(user) {
      const target = document.getElementById('userEditor');
      if (!target || !user) return;
      target.innerHTML = `
        <form id="editUserForm" class="inline-form grid">
          <h3>Edit User</h3>
          <input type="hidden" name="userId" value="${escapeHtml(user.userId)}">
          <label>Role</label>
          <select name="role" required>
            ${['HR', 'Mentor', 'Mentee'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`).join('')}
          </select>
          <label>Name</label>
          <input name="name" required value="${escapeHtml(user.name || user.displayName || '')}">
          <label>Department</label>
          <input name="department" required value="${escapeHtml(user.department || '')}">
          <label>Position</label>
          <input name="position" value="${escapeHtml(user.position || '')}">
          <label>Email</label>
          <input type="email" name="email" required value="${escapeHtml(user.email || '')}">
          <label>Active</label>
          <select name="active">
            <option value="1" ${user.active ? 'selected' : ''}>Active</option>
            <option value="0" ${!user.active ? 'selected' : ''}>Inactive</option>
          </select>
          <div class="wide-actions">
            <button type="submit">Save User</button>
            <button type="button" class="secondary" id="cancelEditUser">Cancel</button>
          </div>
        </form>
      `;
      document.getElementById('cancelEditUser').addEventListener('click', () => {
        target.innerHTML = '';
      });
      document.getElementById('editUserForm').addEventListener('submit', async event => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        payload.active = payload.active === '1';
        try {
          await api('/adminUpdateUser', payload);
          adminCache = null;
          alert('User updated');
          renderAdmin();
        } catch (error) {
          alert(error.message);
        }
      });
    }

    function renderEmployeeEditor(employee = {}) {
      const target = document.getElementById('employeeEditor');
      if (!target) return;
      target.innerHTML = `
        <div class="queue-card" style="margin-top:16px">
          <div class="queue-head">
            <div>
              <strong>${employee.employeeId ? 'Edit Employee Master' : 'Add Employee Master'}</strong>
              <div class="muted" style="margin-top:4px">ใช้สำหรับแก้ข้อมูลพนักงานโดยไม่ต้องเข้า D1 Studio</div>
            </div>
          </div>
          <form id="employeeForm" class="grid" style="margin-top:12px">
            <input type="hidden" name="employeeId" value="${escapeHtml(employee.employeeId || '')}">
            <label>Employee Code</label>
            <input name="employeeCode" required value="${escapeHtml(employee.employeeCode || '')}" placeholder="เช่น NT001">
            <label>Name</label>
            <input name="employeeName" required value="${escapeHtml(employee.employeeName || '')}" placeholder="ชื่อ-นามสกุล">
            <label>Department</label>
            <input name="department" value="${escapeHtml(employee.department || '')}" placeholder="เช่น Operations">
            <label>Position</label>
            <input name="position" value="${escapeHtml(employee.position || '')}" placeholder="เช่น Store Manager">
            <label>Branch</label>
            <input name="branch" value="${escapeHtml(employee.branch || '')}" placeholder="สาขา / พื้นที่">
            <label>Start Date</label>
            <input name="startDate" type="date" value="${escapeHtml(employee.startDate || '')}">
            <label>Employment Status</label>
            <select name="employmentStatus">
              ${['active', 'probation', 'inactive', 'resigned'].map(status => `<option value="${status}" ${status === (employee.employmentStatus || 'active') ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
            <label>Probation</label>
            <select name="probationRequired">
              <option value="0" ${employee.probationRequired ? '' : 'selected'}>Not required</option>
              <option value="1" ${employee.probationRequired ? 'selected' : ''}>Required</option>
            </select>
            <button type="submit">Save Employee</button>
          </form>
        </div>
      `;
      document.getElementById('employeeForm').addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await api('/adminUpsertEmployee', Object.fromEntries(new FormData(event.currentTarget).entries()));
          adminCache = null;
          alert('Employee saved');
          renderAdmin();
        } catch (error) {
          alert(error.message);
        }
      });
    }

    function renderAdminTab(tab, data) {
      const panel = document.getElementById('adminPanel');
      if (!panel) return;
      adminActiveTab = tab;

      if (tab === 'users') {
        panel.innerHTML = `
          <section class="panel">
            <div class="panel-body">
              <div class="ops-header">
                <div>
                  <h2>Users</h2>
                  <p class="muted" style="margin-top:4px">This is the master place to fix role mistakes, update department, and check whether LINE is linked.</p>
                </div>
                <button type="button" class="secondary" data-jump-tab="dashboard">Back to Dashboard</button>
              </div>
              <div class="mobile-table" style="margin-top:12px">
                <table>
                  <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Email</th><th>LINE</th><th>Action</th></tr></thead>
                  <tbody>
                    ${data.users.map(user => `
                      <tr>
                        <td>${escapeHtml(user.name || user.displayName)}</td>
                        <td>${escapeHtml(user.role)}</td>
                        <td>${escapeHtml(user.department)}</td>
                        <td>${escapeHtml(user.email)}</td>
                        <td>${user.lineUserId ? 'Linked' : '-'}</td>
                        <td><button type="button" class="secondary" data-edit-user="${escapeHtml(user.userId)}" style="width:auto;min-height:34px;padding:6px 10px">Edit</button></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <div id="userEditor"></div>
            </div>
          </section>
        `;
        document.querySelectorAll('[data-edit-user]').forEach(button => {
          button.addEventListener('click', () => {
            const user = data.users.find(item => item.userId === button.dataset.editUser);
            renderUserEditor(user);
          });
        });
        return;
      }

      if (tab === 'employees') {
        const employees = data.employees || [];
        const batches = data.importBatches || [];
        panel.innerHTML = `
          <section class="panel">
            <div class="panel-body">
              <div class="ops-header">
                <div>
                  <h2>Employee Master</h2>
                  <p class="muted" style="margin-top:4px">นำเข้าพนักงานจาก CSV, ตรวจสถานะผูก LINE, และแก้ข้อมูลหลักโดยไม่ต้องเข้า SQL</p>
                </div>
                <button type="button" class="secondary" data-jump-tab="dashboard">Back to Dashboard</button>
              </div>
              <div class="note" style="margin-top:12px">
                CSV headers ที่รองรับ: <strong>employee_code, employee_name, department, position, branch, start_date</strong><br>
                start_date ใช้รูปแบบ YYYY-MM-DD และระบบจะไม่รับ SQL จากไฟล์โดยตรง
              </div>
              <form id="employeeImportForm" class="grid" style="margin-top:14px">
                <label>Import Employee CSV</label>
                <input id="employeeCsvFile" type="file" accept=".csv,text/csv">
                <textarea name="csvText" placeholder="หรือวาง CSV ตรงนี้ เช่น&#10;employee_code,employee_name,department,position,branch,start_date&#10;NT001,สมชาย ใจดี,Operations,Store Manager,Central,2026-06-19"></textarea>
                <input name="fileName" placeholder="file name (optional)">
                <button type="submit">Import Employee Master</button>
              </form>
              <div class="wide-actions" style="margin-top:12px">
                <button type="button" class="secondary" id="addEmployeeButton">Add Employee Manually</button>
              </div>
              <div id="employeeEditor"></div>
            </div>
          </section>

          <section class="panel" style="margin-top:16px">
            <div class="panel-body">
              <h2>Employees</h2>
              <div class="mobile-table" style="margin-top:12px">
                <table>
                  <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Start</th><th>LINE</th><th>Action</th></tr></thead>
                  <tbody>
                    ${employees.map(employee => `
                      <tr>
                        <td>${escapeHtml(employee.employeeCode || '-')}</td>
                        <td>${escapeHtml(employee.employeeName || '-')}</td>
                        <td>${escapeHtml(employee.department || '-')}</td>
                        <td>${formatThaiDate(employee.startDate)}</td>
                        <td>${employee.userId ? `Linked${employee.linkedName ? ` · ${escapeHtml(employee.linkedName)}` : ''}` : '<span class="muted">Waiting</span>'}</td>
                        <td>
                          <button type="button" class="secondary" data-edit-employee="${escapeHtml(employee.employeeId)}" style="width:auto;min-height:34px;padding:6px 10px">Edit</button>
                          ${employee.userId ? `<button type="button" class="secondary" data-unlink-employee="${escapeHtml(employee.employeeId)}" style="width:auto;min-height:34px;padding:6px 10px">Unlink</button>` : ''}
                        </td>
                      </tr>
                    `).join('') || '<tr><td colspan="6">ยังไม่มี employee master</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="panel" style="margin-top:16px">
            <div class="panel-body">
              <h2>Import History</h2>
              <div class="grid" style="margin-top:12px">
                ${batches.map(batch => `
                  <div class="queue-card">
                    <div class="queue-head">
                      <div>
                        <strong>${escapeHtml(batch.fileName || batch.batchId)}</strong>
                        <div class="muted">${formatThaiDate(batch.createdAt)} · total ${batch.totalRows}</div>
                      </div>
                      <span class="pill">${batch.errorRows ? `${batch.errorRows} errors` : 'OK'}</span>
                    </div>
                    <div class="muted" style="margin-top:8px">new ${batch.newRows} · updated ${batch.updatedRows} · skipped ${batch.skippedRows}</div>
                  </div>
                `).join('') || '<p class="muted">ยังไม่มีประวัติ import</p>'}
              </div>
            </div>
          </section>
        `;

        const fileInput = document.getElementById('employeeCsvFile');
        const importForm = document.getElementById('employeeImportForm');
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;
          importForm.fileName.value = file.name;
          importForm.csvText.value = await file.text();
        });
        importForm.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            const result = await api('/adminImportEmployees', Object.fromEntries(new FormData(event.currentTarget).entries()));
            adminCache = null;
            alert(`Imported: new ${result.newRows}, updated ${result.updatedRows}, errors ${result.errorRows}`);
            renderAdmin();
          } catch (error) {
            alert(error.message);
          }
        });
        document.getElementById('addEmployeeButton').addEventListener('click', () => renderEmployeeEditor({}));
        document.querySelectorAll('[data-edit-employee]').forEach(button => {
          button.addEventListener('click', () => {
            const employee = employees.find(item => item.employeeId === button.dataset.editEmployee);
            renderEmployeeEditor(employee);
          });
        });
        document.querySelectorAll('[data-unlink-employee]').forEach(button => {
          button.addEventListener('click', async () => {
            if (!confirm('Unlink LINE account from this employee?')) return;
            try {
              await api('/adminUnlinkEmployee', { employeeId: button.dataset.unlinkEmployee, reason: 'admin_ui' });
              adminCache = null;
              alert('LINE account unlinked');
              renderAdmin();
            } catch (error) {
              alert(error.message);
            }
          });
        });
        return;
      }

      if (tab === 'groups') {
        const mentors = data.users.filter(user => user.role === 'Mentor');
        const mentees = data.users.filter(user => user.role === 'Mentee');
        const activeSessionsByGroup = (data.sessions || []).reduce((map, session) => {
          if (!session.groupId || session.status === 'Closed') return map;
          map[session.groupId] = (map[session.groupId] || 0) + 1;
          return map;
        }, {});
        panel.innerHTML = `
          <section class="panel">
            <div class="panel-body">
              <div class="ops-header">
                <div>
                  <h2>Onboarding Groups</h2>
                  <p class="muted" style="margin-top:4px">Build one cohort, then attach mentor + mentees before creating sessions.</p>
                </div>
                <button type="button" class="secondary" data-jump-tab="dashboard">Back to Dashboard</button>
              </div>
              <form id="groupForm" class="grid" style="margin-top:14px">
                <label>Group Name</label>
                <input name="groupName" required placeholder="เช่น OB June Week 4">
                <label>Start Date</label>
                <input name="startDate" type="date" required>
                <label>Interval Days</label>
                <input name="intervalDays" type="number" value="30" min="1">
                <label>Total Months</label>
                <input name="totalMonths" type="number" value="4" min="1">
                <button type="submit">Create Group</button>
              </form>

              <div class="grid" style="margin-top:18px">
                ${(data.groups || []).map(group => `
                  ${(() => {
                    const members = (data.groupMembers || []).filter(member => member.groupId === group.groupId && member.active);
                    const assignedMentees = members.filter(member => member.role === 'Mentee');
                    const assignedMentors = members.filter(member => member.role === 'Mentor');
                    const mentorId = assignedMentees.find(member => member.mentorUserId)?.mentorUserId || '';
                    const mentor = mentors.find(user => user.userId === mentorId);
                    return `
                  <div class="queue-card">
                    <div class="queue-head">
                      <div>
                        <strong>${escapeHtml(group.groupName)}</strong>
                        <p class="muted" style="margin-top:4px">Start: ${formatThaiDate(group.startDate)} · Every ${group.intervalDays} days · ${group.totalMonths} months</p>
                        <p class="muted" style="margin-top:4px">Mentees: ${assignedMentees.length} · Mentors: ${assignedMentors.length || (mentor ? 1 : 0)} · Default: ${mentor ? escapeHtml(mentor.name || mentor.displayName) : 'ยังไม่เลือก'} · Open sessions: ${activeSessionsByGroup[group.groupId] || 0}</p>
                      </div>
                      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                        <button type="button" class="secondary" data-assign-group="${escapeHtml(group.groupId)}" style="width:auto">Manage Members</button>
                        <button type="button" class="secondary" data-jump-tab="sessions" style="width:auto">Create Session</button>
                      </div>
                    </div>
                  </div>
                    `;
                  })()}
                `).join('') || '<div class="note">ยังไม่มีกลุ่ม onboarding</div>'}
              </div>
              <div id="groupAssignPanel"></div>
            </div>
          </section>
        `;
        document.getElementById('groupForm').addEventListener('submit', async event => {
          event.preventDefault();
          try {
            await api('/createOnboardingGroup', Object.fromEntries(new FormData(event.currentTarget).entries()));
            adminCache = null;
            alert('Group created');
            renderAdmin();
          } catch (error) {
            alert(error.message);
          }
        });
        document.querySelectorAll('[data-assign-group]').forEach(button => {
          button.addEventListener('click', () => {
            const group = (data.groups || []).find(item => item.groupId === button.dataset.assignGroup);
            const activeMembers = (data.groupMembers || []).filter(member => member.groupId === group.groupId && member.active);
            const assignedIds = new Set(activeMembers.filter(member => member.role === 'Mentee').map(member => member.userId));
            const defaultMentorId = activeMembers.find(member => member.role === 'Mentee' && member.mentorUserId)?.mentorUserId || '';
            const assignedMentorIds = new Set(activeMembers.filter(member => member.role === 'Mentor').map(member => member.userId));
            if (defaultMentorId) assignedMentorIds.add(defaultMentorId);
            const target = document.getElementById('groupAssignPanel');
            target.innerHTML = `
              <form id="assignGroupForm" class="inline-form grid">
                <div class="ops-header">
                  <div>
                    <h3>Manage Members: ${escapeHtml(group.groupName)}</h3>
                    <p class="muted" style="margin-top:4px">เลือก mentor ได้หลายคนและ mentee ได้หลายคน ระบบจะสร้าง feedback task ให้ mentor ทุกคนประเมิน mentee ทุกคนในกลุ่ม</p>
                  </div>
                  <span class="ops-status">${assignedMentorIds.size} mentors · ${assignedIds.size} mentees</span>
                </div>
                <input type="hidden" name="groupId" value="${escapeHtml(group.groupId)}">
                <label>Default Mentor</label>
                <select name="mentorUserId">
                  <option value="">No default mentor</option>
                  ${mentors.map(user => `<option value="${escapeHtml(user.userId)}" ${user.userId === defaultMentorId ? 'selected' : ''}>${escapeHtml(user.name || user.displayName)} (${escapeHtml(user.department || '-')})</option>`).join('')}
                </select>
                <label>Mentors in this group</label>
                <div class="member-picker compact-picker">
                  ${mentors.map(user => {
                    const label = `${user.name || user.displayName || ''} ${user.department || ''} ${user.email || ''}`.toLowerCase();
                    return `
                      <label class="member-option" data-member-search="${escapeHtml(label)}">
                        <input type="checkbox" name="mentorUserIds" value="${escapeHtml(user.userId)}" ${assignedMentorIds.has(user.userId) ? 'checked' : ''}>
                        <span>
                          <strong>${escapeHtml(user.name || user.displayName || user.userId)}</strong>
                          <small>${escapeHtml(user.department || '-')} · Mentor</small>
                        </span>
                      </label>
                    `;
                  }).join('') || '<div class="note">ยังไม่มี mentor ที่ลงทะเบียนแล้ว</div>'}
                </div>
                <label>Mentees</label>
                <input type="search" id="memberSearch" placeholder="ค้นหาชื่อ แผนก หรืออีเมล">
                <div class="member-picker">
                  ${mentees.map(user => {
                    const label = `${user.name || user.displayName || ''} ${user.department || ''} ${user.email || ''}`.toLowerCase();
                    return `
                      <label class="member-option" data-member-search="${escapeHtml(label)}">
                        <input type="checkbox" name="userIds" value="${escapeHtml(user.userId)}" ${assignedIds.has(user.userId) ? 'checked' : ''}>
                        <span>
                          <strong>${escapeHtml(user.name || user.displayName || user.userId)}</strong>
                          <small>${escapeHtml(user.department || '-')} · ${escapeHtml(user.email || 'LINE linked')}</small>
                        </span>
                      </label>
                    `;
                  }).join('') || '<div class="note">ยังไม่มี mentee ที่ลงทะเบียนและผูก LINE แล้ว</div>'}
                </div>
                <div class="note">ระบบจะแสดงเฉพาะ Mentee ที่ผูก LINE แล้วเท่านั้น ถ้าพนักงานยังไม่ขึ้น ให้ให้เขาเข้า LIFF เพื่อลงทะเบียนหรือผูก employee code ก่อน</div>
                <button type="submit">Save Members & Prepare Tasks</button>
              </form>
            `;
            const search = document.getElementById('memberSearch');
            if (search) {
              search.addEventListener('input', () => {
                const keyword = search.value.trim().toLowerCase();
                document.querySelectorAll('.member-option').forEach(option => {
                  option.style.display = !keyword || option.dataset.memberSearch.includes(keyword) ? 'flex' : 'none';
                });
              });
            }
            document.getElementById('assignGroupForm').addEventListener('submit', async event => {
              event.preventDefault();
              const form = event.currentTarget;
              const payload = {
                groupId: form.groupId.value,
                mentorUserId: form.mentorUserId.value,
                mentorUserIds: [...form.querySelectorAll('input[name="mentorUserIds"]:checked')].map(option => option.value),
                userIds: [...form.querySelectorAll('input[name="userIds"]:checked')].map(option => option.value)
              };
              if (payload.mentorUserId && !payload.mentorUserIds.includes(payload.mentorUserId)) {
                payload.mentorUserIds.push(payload.mentorUserId);
              }
              try {
                const result = await api('/updateGroupMembers', payload);
                adminCache = null;
                adminNotice = {
                  title: 'บันทึกสมาชิกกลุ่มแล้ว',
                  body: `เลือก mentor ${result.activeMentors || 0} คน · mentee ${result.activeMentees || 0} คน · session ที่เปิดอยู่ ${result.openSessions || 0} รายการ · สร้าง task ใหม่ ${result.createdTasks || 0} งาน · อัปเดต task เดิม ${result.updatedTasks || 0} งาน`,
                  nextTab: result.openSessions ? 'messages' : 'sessions',
                  nextLabel: result.openSessions ? 'ไปส่ง LINE Cards' : 'ไปสร้าง Session'
                };
                renderAdmin();
              } catch (error) {
                alert(error.message);
              }
            });
          });
        });
        return;
      }

      if (tab === 'sessions') {
        panel.innerHTML = `
          <section class="panel">
            <div class="panel-body">
              <div class="ops-header">
                <div>
                  <h2>Schedule Onboarding Session</h2>
                  <p class="muted" style="margin-top:4px">Create or edit real sessions. Auto-create tasks when the session should immediately start the month workflow.</p>
                </div>
                <button type="button" class="secondary" data-jump-tab="dashboard">Back to Dashboard</button>
              </div>
              <form id="checkpointForm" class="grid" style="margin-top:14px">
                <input type="hidden" name="checkpointId">
                <label>Onboarding Group</label>
                <select name="groupId">
                  <option value="">All active users (fallback)</option>
                  ${(data.groups || []).map(group => `<option value="${escapeHtml(group.groupId)}">${escapeHtml(group.groupName)}</option>`).join('')}
                </select>
                <label>Month No</label>
                <input name="monthNo" type="number" min="1" value="1">
                <label>Session Title</label>
                <input name="checkpointName" required placeholder="Session title">
                <label>Session Date</label>
                <input name="sessionDate" type="date" required>
                <label>Start Time</label>
                <input name="startTime" type="time">
                <label>End Time</label>
                <input name="endTime" type="time">
                <label>Room / Meeting Link</label>
                <input name="room" placeholder="Room or meeting link">
                <label>Description</label>
                <textarea name="description" placeholder="Description"></textarea>
                <label>Task Creation</label>
                <select name="autoCreateTasks">
                  <option value="1">Auto-create tasks for selected group</option>
                  <option value="0">Save session only</option>
                </select>
                <button type="submit">Save Session</button>
              </form>
              <div id="sessionEditorHint" class="muted" style="margin-top:10px"></div>
            </div>
          </section>
          <section class="panel" style="margin-top:16px">
            <div class="panel-body">
              <h2>Scheduled Sessions</h2>
              <div class="grid" style="margin-top:14px">
                ${data.sessions.length ? data.sessions.map(session => `
                  <div class="session-card">
                    <div class="session-head">
                      <div>
                        <span class="pill">MONTH ${escapeHtml(session.monthNo || '1')}</span>
                        <h3 style="margin-top:9px">${escapeHtml(session.checkpointName)}</h3>
                        <div class="muted">${formatThaiDate(session.sessionDate)} · ${escapeHtml(session.startTime || '-')} - ${escapeHtml(session.endTime || '-')} · ${escapeHtml(session.room || '-')}</div>
                        <div class="muted" style="margin-top:4px">Group: ${escapeHtml(renderSessionGroupName(session, data))}</div>
                      </div>
                      <div style="display:grid;gap:8px;justify-items:end">
                        <span class="pill">${escapeHtml(session.status || 'Open')}</span>
                        <button type="button" class="secondary" data-edit-session="${escapeHtml(session.checkpointId)}" style="width:auto;min-height:34px;padding:6px 10px">Edit</button>
                      </div>
                    </div>
                  </div>
                `).join('') : '<div class="note">ยังไม่มี Session ที่สร้างไว้</div>'}
              </div>
            </div>
          </section>
        `;
        document.getElementById('checkpointForm').addEventListener('submit', async event => {
          event.preventDefault();
          try {
            const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
            const result = await api(formData.checkpointId ? '/updateCheckpoint' : '/createCheckpoint', formData);
            adminCache = null;
            adminNotice = formData.checkpointId
              ? {
                  title: 'อัปเดต Session แล้ว',
                  body: 'ข้อมูลวัน เวลา ห้อง และรายละเอียดถูกบันทึกเรียบร้อย',
                  nextTab: 'messages',
                  nextLabel: 'ไปส่ง LINE Cards'
                }
              : {
                  title: 'สร้าง Session แล้ว',
                  body: `ระบบเตรียม task ใหม่ ${result.createdTasks || 0} งาน · อัปเดต task เดิม ${result.updatedTasks || 0} งาน · ข้ามงานที่ทำเสร็จแล้ว ${result.skippedCompleted || 0} งาน`,
                  nextTab: 'messages',
                  nextLabel: 'ไปส่ง LINE Cards'
                };
            renderAdmin();
          } catch (error) {
            alert(error.message);
          }
        });
        document.querySelectorAll('[data-edit-session]').forEach(button => {
          button.addEventListener('click', () => {
            const session = (data.sessions || []).find(item => item.checkpointId === button.dataset.editSession);
            if (!session) return;
            const form = document.getElementById('checkpointForm');
            form.checkpointId.value = session.checkpointId;
            form.groupId.value = session.groupId || '';
            form.monthNo.value = session.monthNo || 1;
            form.checkpointName.value = session.checkpointName || '';
            form.sessionDate.value = session.sessionDate || '';
            form.startTime.value = session.startTime || '';
            form.endTime.value = session.endTime || '';
            form.room.value = session.room || '';
            form.description.value = session.description || '';
            const hint = document.getElementById('sessionEditorHint');
            if (hint) hint.textContent = `Editing session ${session.checkpointName} (${session.checkpointId})`;
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
        const form = document.getElementById('checkpointForm');
        const groupSelect = form.querySelector('[name="groupId"]');
        const monthInput = form.querySelector('[name="monthNo"]');
        const dateInput = form.querySelector('[name="sessionDate"]');
        const titleInput = form.querySelector('[name="checkpointName"]');
        const hint = document.getElementById('sessionEditorHint');
        const applySessionSuggestion = () => {
          if (form.checkpointId.value) return;
          const group = (data.groups || []).find(item => item.groupId === groupSelect.value);
          const monthNo = Number(monthInput.value || 1);
          if (!group) {
            if (hint && !form.checkpointId.value) hint.textContent = '';
            return;
          }
          const suggestedDate = addDaysToDateString(group.startDate, Math.max(0, monthNo - 1) * Number(group.intervalDays || 30));
          if (!dateInput.value) dateInput.value = suggestedDate;
          if (!titleInput.value) titleInput.value = `Month ${monthNo} - ${group.groupName}`;
          if (hint) hint.textContent = `Suggested by group schedule: ${formatThaiDate(suggestedDate)} from ${group.groupName}`;
        };
        groupSelect.addEventListener('change', applySessionSuggestion);
        monthInput.addEventListener('change', applySessionSuggestion);
        return;
      }

      if (tab === 'messages') {
        panel.innerHTML = `
          <section class="panel">
            <div class="panel-body">
              <div class="ops-header">
                <div>
                  <h2>Send LINE Message</h2>
                  <p class="muted" style="margin-top:4px">Send a generic reminder or a task-specific Flex card to the exact person.</p>
                </div>
                <button type="button" class="secondary" data-jump-tab="dashboard">Back to Dashboard</button>
              </div>
              <form id="messageForm" class="grid" style="margin-top:14px">
                <label>User</label>
                <select name="userId" id="messageUserId" required>
                  ${data.users.filter(user => user.lineUserId).map(user => `<option value="${escapeHtml(user.userId)}">${escapeHtml(user.name || user.displayName)} (${escapeHtml(user.role)})</option>`).join('')}
                </select>
                <label>Template</label>
                <select id="messageTemplate">
                  <option value="">No template</option>
                  ${(data.templates || []).filter(template => template.active).map(template => `<option value="${escapeHtml(template.templateId)}">${escapeHtml(template.title)} · ${escapeHtml(template.audience)}</option>`).join('')}
                </select>
                <label>Task Flex (optional)</label>
                <select name="taskId" id="messageTaskId">
                  <option value="">Send generic reminder</option>
                  ${data.tasks.filter(task => task.status !== 'Completed').map(task => `<option value="${escapeHtml(task.taskId)}" data-owner="${escapeHtml(task.ownerUserId)}">${escapeHtml(task.title)} · ${escapeHtml(task.taskType)} · due ${escapeHtml(task.dueDate || '-')}</option>`).join('')}
                </select>
                <label>Fallback Message</label>
                <textarea name="message" required>แจ้งเตือนจาก Nose Tea Onboarding: กรุณาตรวจสอบงานของคุณใน LIFF</textarea>
                <button type="submit">Send LINE Message</button>
              </form>
              <hr style="border:0;border-top:1px solid #eef2f6;margin:22px 0">
              <h3>Send Segment</h3>
              <form id="segmentForm" class="grid" style="margin-top:14px">
                <select name="segment" required>
                  <option value="linked">All linked users</option>
                  <option value="mentors">All mentors</option>
                  <option value="mentees">All mentees</option>
                  <option value="pending">Users with pending tasks</option>
                </select>
                <select id="segmentTemplate">
                  <option value="">No template</option>
                  ${(data.templates || []).filter(template => template.active).map(template => `<option value="${escapeHtml(template.templateId)}">${escapeHtml(template.title)} · ${escapeHtml(template.audience)}</option>`).join('')}
                </select>
                <textarea name="message" required>กรุณาเปิด LIFF เพื่อตรวจสอบงาน onboarding ของคุณ</textarea>
                <button type="submit" class="warning">Send Segment Flex</button>
              </form>
            </div>
          </section>
        `;
        document.getElementById('messageForm').addEventListener('submit', async event => {
          event.preventDefault();
          try {
            await api('/sendLineMessage', Object.fromEntries(new FormData(event.currentTarget).entries()));
            alert('Sent');
          } catch (error) {
            alert(error.message);
          }
        });
        const userSelect = document.getElementById('messageUserId');
        const taskSelect = document.getElementById('messageTaskId');
        const templateSelect = document.getElementById('messageTemplate');
        const messageForm = document.getElementById('messageForm');
        const filterTasksForUser = () => {
          const userId = userSelect.value;
          [...taskSelect.options].forEach((option, index) => {
            if (index === 0) {
              option.hidden = false;
              return;
            }
            option.hidden = option.dataset.owner !== userId;
          });
          if (taskSelect.selectedOptions[0] && taskSelect.selectedOptions[0].hidden) {
            taskSelect.value = '';
          }
        };
        userSelect.addEventListener('change', filterTasksForUser);
        templateSelect.addEventListener('change', () => {
          const template = (data.templates || []).find(item => item.templateId === templateSelect.value);
          if (!template) return;
          messageForm.message.value = template.body || messageForm.message.value;
        });
        if (pendingMessageUserId) {
          const exists = [...userSelect.options].some(option => option.value === pendingMessageUserId);
          if (exists) {
            userSelect.value = pendingMessageUserId;
            userSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          pendingMessageUserId = '';
        }
        filterTasksForUser();
        const segmentForm = document.getElementById('segmentForm');
        const segmentTemplate = document.getElementById('segmentTemplate');
        segmentTemplate.addEventListener('change', () => {
          const template = (data.templates || []).find(item => item.templateId === segmentTemplate.value);
          if (!template) return;
          segmentForm.message.value = template.body || segmentForm.message.value;
        });
        segmentForm.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            const result = await api('/sendSegmentLine', Object.fromEntries(new FormData(event.currentTarget).entries()));
            alert(`Sent: ${result.sent}, Failed: ${result.failed}`);
          } catch (error) {
            alert(error.message);
          }
        });
        return;
      }

      if (tab === 'templates') {
        panel.innerHTML = `
          <section class="panel">
            <div class="panel-body">
              <h2>Message Template Library</h2>
              <p class="muted" style="margin-top:4px">คลังข้อความที่ใช้ซ้ำสำหรับ reminder, session announcement, feedback และ reflection</p>
              <form id="templateForm" class="grid" style="margin-top:14px">
                <input type="hidden" name="templateId">
                <label>Template Key</label>
                <input name="templateKey" required placeholder="e.g. month_1_reflection_due">
                <label>Audience</label>
                <select name="audience">
                  <option value="All">All</option>
                  <option value="Mentor">Mentor</option>
                  <option value="Mentee">Mentee</option>
                  <option value="HR">HR</option>
                </select>
                <label>Title</label>
                <input name="title" required placeholder="Message title">
                <label>Body</label>
                <textarea name="body" required placeholder="Message body"></textarea>
                <label>Button Label</label>
                <input name="buttonLabel" value="Open LIFF">
                <label>Active</label>
                <select name="active"><option value="1">Active</option><option value="0">Inactive</option></select>
                <button type="submit">Save Template</button>
              </form>
              <div class="grid" style="margin-top:18px">
                ${(data.templates || []).map(template => `
                  <div class="queue-card">
                    <div class="queue-head">
                      <div>
                        <strong>${escapeHtml(template.title)}</strong>
                        <p class="muted" style="margin-top:4px">${escapeHtml(template.templateKey)} · ${escapeHtml(template.audience)} · ${template.active ? 'Active' : 'Inactive'}</p>
                        <p class="muted" style="margin-top:4px">${escapeHtml(template.body)}</p>
                      </div>
                      <button type="button" class="secondary" data-edit-template="${escapeHtml(template.templateId)}" style="width:auto;min-width:78px">Edit</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>
        `;
        const form = document.getElementById('templateForm');
        document.querySelectorAll('[data-edit-template]').forEach(button => {
          button.addEventListener('click', () => {
            const template = (data.templates || []).find(item => item.templateId === button.dataset.editTemplate);
            if (!template) return;
            form.templateId.value = template.templateId;
            form.templateKey.value = template.templateKey;
            form.audience.value = template.audience;
            form.title.value = template.title;
            form.body.value = template.body;
            form.buttonLabel.value = template.buttonLabel;
            form.active.value = template.active ? '1' : '0';
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
          payload.active = payload.active === '1';
          try {
            await api('/upsertMessageTemplate', payload);
            adminCache = null;
            alert('Template saved');
            renderAdmin();
          } catch (error) {
            alert(error.message);
          }
        });
        return;
      }

      if (tab === 'more') {
        panel.innerHTML = `
          <section class="panel">
            <div class="panel-body">
              <h2>More Tools</h2>
              <p class="muted" style="margin-top:4px">เครื่องมือทดสอบและดูตัวอย่าง แยกจากหน้าทำงานจริงเพื่อลดความสับสน</p>
              <div class="wide-actions">
                <button type="button" id="morePreviewMentor">Preview Mentor</button>
                <button type="button" id="morePreviewMentee" class="secondary">Preview Mentee</button>
                <button type="button" id="moreSendMentorFlex" class="warning">Send Mentor Card to Me</button>
                <button type="button" id="moreSendMenteeFlex" class="warning">Send Mentee Card to Me</button>
              </div>
            </div>
          </section>
        `;
        document.getElementById('morePreviewMentor').addEventListener('click', () => previewAs('Mentor'));
        document.getElementById('morePreviewMentee').addEventListener('click', () => previewAs('Mentee'));
        document.getElementById('moreSendMentorFlex').addEventListener('click', () => sendPreviewFlex('Mentor'));
        document.getElementById('moreSendMenteeFlex').addEventListener('click', () => sendPreviewFlex('Mentee'));
        return;
      }

      const mentors = data.users.filter(user => user.role === 'Mentor').length;
      const mentees = data.users.filter(user => user.role === 'Mentee').length;
      panel.innerHTML = renderAdminOverview(data);
      const forceForm = document.getElementById('forceTaskForm');
      if (forceForm) {
        forceForm.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            const result = await api('/forceTasks', Object.fromEntries(new FormData(event.currentTarget).entries()));
            adminCache = null;
            alert(`Created ${result.count}, Updated ${result.updatedExisting}, Skipped completed ${result.skippedCompleted} for ${result.ownerRole}`);
            renderAdmin();
          } catch (error) {
            alert(error.message);
          }
        });
      }
      const syncButton = document.getElementById('syncLifecycle');
      if (syncButton) {
        syncButton.addEventListener('click', async () => {
          syncButton.disabled = true;
          syncButton.textContent = 'Syncing...';
          try {
            const result = await api('/syncGroupLifecycle');
            const target = document.getElementById('syncLifecycleResult');
            if (target) {
              target.textContent = `Created checkpoints ${result.createdCheckpoints}, created tasks ${result.createdTasks}, updated tasks ${result.updatedTasks}, skipped completed ${result.skippedCompleted}`;
            }
            adminCache = null;
          } catch (error) {
            alert(error.message);
          } finally {
            syncButton.disabled = false;
            syncButton.textContent = 'Sync Group Lifecycle';
          }
        });
      }
      const syncShortcut = document.getElementById('syncLifecycleShortcut');
      if (syncShortcut) {
        syncShortcut.addEventListener('click', async () => {
          syncShortcut.disabled = true;
          syncShortcut.textContent = 'Syncing...';
          try {
            const result = await api('/syncGroupLifecycle');
            adminCache = null;
            alert(`Sync done: checkpoints ${result.createdCheckpoints}, created tasks ${result.createdTasks}, updated tasks ${result.updatedTasks}, skipped completed ${result.skippedCompleted}`);
            renderAdmin();
          } catch (error) {
            alert(error.message);
          } finally {
            syncShortcut.disabled = false;
            syncShortcut.textContent = 'Sync Group Lifecycle';
          }
        });
      }
      const runDailyButton = document.getElementById('runDailyAutomation');
      if (runDailyButton) {
        runDailyButton.addEventListener('click', async () => {
          runDailyButton.disabled = true;
          runDailyButton.textContent = 'Running...';
          try {
            const result = await api('/runDailyAutomation');
            const target = document.getElementById('runDailyAutomationResult');
            if (target) {
              target.textContent = `Checked ${result.candidates || 0} pending tasks · selected ${result.selected || 0} · sent ${result.sent || 0} · failed ${result.failed || 0}`;
            }
            adminCache = null;
          } catch (error) {
            alert(error.message);
          } finally {
            runDailyButton.disabled = false;
            runDailyButton.textContent = 'Run 09:00 Automation Now';
          }
        });
      }
      document.querySelectorAll('[data-jump-tab]').forEach(button => {
        button.addEventListener('click', () => {
          const targetTab = button.dataset.jumpTab;
          document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item.dataset.tab === targetTab));
          renderAdminTab(targetTab, data);
        });
      });
      document.querySelectorAll('.stat-panel[data-jump-tab]').forEach(button => {
        button.addEventListener('click', () => {
          const targetTab = button.dataset.jumpTab;
          document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item.dataset.tab === targetTab));
          renderAdminTab(targetTab, data);
        });
      });
      document.querySelectorAll('[data-open-task-message]').forEach(button => {
        button.addEventListener('click', () => {
          const task = (data.tasks || []).find(item => item.taskId === button.dataset.openTaskMessage);
          if (!task) return;
          document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item.dataset.tab === 'messages'));
          renderAdminTab('messages', data);
          setTimeout(() => {
            const userSelect = document.getElementById('messageUserId');
            const taskSelect = document.getElementById('messageTaskId');
            if (userSelect) userSelect.value = task.ownerUserId;
            if (taskSelect) taskSelect.value = task.taskId;
            if (userSelect) userSelect.dispatchEvent(new Event('change'));
          }, 0);
        });
      });
      document.querySelectorAll('[data-edit-session]').forEach(button => {
        button.addEventListener('click', () => {
          document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item.dataset.tab === 'sessions'));
          renderAdminTab('sessions', data);
          setTimeout(() => {
            const editButton = document.querySelector(`[data-edit-session="${button.dataset.editSession}"]`);
            if (editButton) editButton.click();
          }, 0);
        });
      });
      document.querySelectorAll('[data-send-now]').forEach(button => {
        button.addEventListener('click', async () => {
          try {
            const result = await api('/sendSegmentLine', {
              segment: button.dataset.sendNow,
              message: button.dataset.message
            });
            alert(`Sent: ${result.sent}, Failed: ${result.failed}`);
          } catch (error) {
            alert(error.message);
          }
        });
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
            currentUser = { role: 'HR', name: 'Web Admin' };
            await renderHrHome();
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
        const portal = await api('/getPortal');
        if (!portal.registered) {
          renderRegister();
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
        renderPortal(portal.user, portal.tasks || [], { meta: portal });
      } catch (error) {
        render(`
          <div class="m3-app m3-fade-up">
            ${m3TopBar({ title: 'Nose Tea' })}
            <main class="m3-main" style="align-items:center;text-align:center;gap:18px;padding-top:48px">
              <div class="m3-list-icon m3-list-icon--error" style="width:64px;height:64px">${micon('error')}</div>
              <div><h2 class="m3-title" style="font-size:22px">เปิดระบบไม่สำเร็จ</h2><p class="m3-eyebrow" style="margin-top:6px">${escapeHtml(error.message || 'เกิดข้อผิดพลาด')}</p></div>
              <button type="button" class="m3-btn" style="max-width:280px" onclick="location.reload()">${micon('refresh')}ลองใหม่อีกครั้ง</button>
            </main>
          </div>
        `);
      }
    }

    boot();

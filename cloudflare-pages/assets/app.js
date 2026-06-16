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
      if (!expectedState || expectedState !== state) {
        throw new Error('LINE login state mismatch. Please try again.');
      }
      localStorage.removeItem('noseTeaWebLoginState');
      const result = await api('/webLoginExchange', {
        code,
        redirectUri: webRedirectUri()
      });
      webSessionToken = result.token;
      localStorage.setItem('noseTeaWebSession', webSessionToken);
      currentUser = result.user;
      window.history.replaceState({}, document.title, webRedirectUri());
      renderAdmin();
    }

    function logoutWebAdmin() {
      webSessionToken = '';
      localStorage.removeItem('noseTeaWebSession');
      adminCache = null;
      currentUser = null;
      renderWebFallback();
    }

    function renderWebFallback() {
      render(shell('เปิดผ่านเว็บบราวเซอร์', `
        <div class="note">
          หน้านี้ใช้งานจริงผ่าน LINE LIFF เพื่อดึง LINE UserID อัตโนมัติ<br>
          สำหรับ HR/Admin สามารถ login ผ่าน LINE Login เพื่อใช้ dashboard บนเว็บได้
        </div>
        <button type="button" id="webAdminLogin">Login HR Admin ด้วย LINE</button>
        <a class="btn" href="https://liff.line.me/2010372532-0i3JE94q">เปิดผ่าน LINE LIFF</a>
        <button type="button" class="secondary" id="webPreviewMentor">Preview Mentor บนเว็บ</button>
        <button type="button" class="secondary" id="webPreviewMentee">Preview Mentee บนเว็บ</button>
        <button type="button" class="secondary" id="healthCheckApi">Health Check API</button>
        <div id="webFallbackResult" class="muted" style="margin-top:14px"></div>
      `));

      document.getElementById('webAdminLogin').addEventListener('click', startWebLogin);
      document.getElementById('webPreviewMentor').addEventListener('click', () => {
        currentUser = {
          role: 'HR',
          name: 'Web Preview',
          displayName: 'Web Preview',
          department: 'HR',
          position: 'Admin'
        };
        previewAs('Mentor');
      });
      document.getElementById('webPreviewMentee').addEventListener('click', () => {
        currentUser = {
          role: 'HR',
          name: 'Web Preview',
          displayName: 'Web Preview',
          department: 'HR',
          position: 'Admin'
        };
        previewAs('Mentee');
      });
      document.getElementById('healthCheckApi').addEventListener('click', async () => {
        const result = document.getElementById('webFallbackResult');
        result.textContent = 'กำลังตรวจสอบ API...';
        try {
          const response = await fetch(`${API_BASE}/`);
          const text = await response.text();
          result.textContent = `API reachable: ${text}`;
        } catch (error) {
          result.textContent = `API unreachable: ${error.message}`;
        }
      });
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

    function roleNav(role) {
      if (role === 'Mentor') {
        return [
          ['home', '🏠', 'Home'],
          ['tasks', '📋', 'My Tasks'],
          ['mentees', '👥', 'Mentees'],
          ['journey', '🗓', 'Checkpoints'],
          ['profile', '👤', 'Profile']
        ];
      }
      return [
        ['home', '🏠', 'Home'],
        ['journey', '🗺', 'Journey'],
        ['tasks', '📋', 'Tasks'],
        ['learning', '📚', 'Learning'],
        ['profile', '👤', 'Profile']
      ];
    }

    function bottomNav(role, active) {
      const items = roleNav(role);
      return `<nav class="bottom-nav" style="grid-template-columns:repeat(${items.length},1fr)">
        ${items.map(item => `<button type="button" class="${active === item[0] ? 'active' : ''}" data-portal-tab="${item[0]}"><strong>${item[1]}</strong>${item[2]}</button>`).join('')}
      </nav>`;
    }

    function journeyContent(tasks) {
      const grouped = [1, 2, 3, 4].map(month => {
        const monthTasks = tasks.filter(task => String(task.title || '').includes(`Month ${month}`) || String(task.description || '').includes(`Month ${month}`));
        const done = monthTasks.filter(task => task.status === 'Completed').length;
        const total = monthTasks.length;
        return { month, done, total, percent: total ? Math.round((done / total) * 100) : 0 };
      });
      return `
        <div class="section-title">Journey Timeline</div>
        <div class="grid">
          ${grouped.map(item => `
            <section class="task-card" style="padding:14px">
              <div class="task-head">
                <div>
                  <strong>Month ${item.month}</strong>
                  <p class="muted" style="margin-top:3px">${item.done}/${item.total || 3} completed</p>
                </div>
                <span class="pill ${item.percent === 100 ? '' : 'warn'}">${item.percent}%</span>
              </div>
              <div class="progress-track" style="margin-top:12px"><div class="progress-fill" style="width:${item.percent}%"></div></div>
            </section>
          `).join('')}
        </div>
      `;
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

    function mentorSummaryCards(mentees, tasks) {
      const pendingFeedback = tasks.filter(task => task.taskType === 'Feedback' && task.status !== 'Completed').length;
      const activeMentees = mentees.length;
      const furthestMonth = mentees.reduce((max, mentee) => Math.max(max, Number(mentee.currentMonth || 1)), 1);
      return `
        <div class="section-title">Mentor Overview</div>
        <div class="quick-cards">
          <div class="quick-card"><span>Mentees</span><strong>${activeMentees}</strong></div>
          <div class="quick-card"><span>Pending</span><strong>${pendingFeedback}</strong></div>
          <div class="quick-card"><span>Latest Month</span><strong>Month ${furthestMonth}</strong></div>
        </div>
      `;
    }

    function mentorMenteeCards(mentees) {
      return `
        <div class="section-title">Assigned Mentees</div>
        <div class="grid">
          ${mentees.length ? mentees.map(mentee => `
            <section class="task-card" style="padding:14px">
              <div class="task-head">
                <div>
                  <strong>${escapeHtml(mentee.name)}</strong>
                  <p class="muted" style="margin-top:3px">${escapeHtml(mentee.department || '-')} · ${escapeHtml(mentee.position || '-')}</p>
                </div>
                <span class="pill ${mentee.pendingFeedback ? 'warn' : ''}">M${escapeHtml(mentee.currentMonth || 1)}</span>
              </div>
              <div class="detail-list" style="margin-top:12px">
                <div class="detail-row"><span>Progress</span><strong>${escapeHtml(mentee.progressPercent || 0)}%</strong></div>
                <div class="detail-row"><span>Completed</span><strong>${escapeHtml(mentee.completedTasks || 0)}/${escapeHtml(mentee.totalTasks || 0)}</strong></div>
                <div class="detail-row"><span>Pending Feedback</span><strong>${escapeHtml(mentee.pendingFeedback || 0)}</strong></div>
              </div>
            </section>
          `).join('') : '<section class="task-card" style="padding:14px"><strong>ยังไม่มี mentee ที่ถูก assign</strong><p class="muted" style="margin-top:6px">เมื่อสร้าง group และ assign mentor แล้ว รายชื่อจะขึ้นที่นี่อัตโนมัติ</p></section>'}
        </div>
      `;
    }

    function menteeSupportCards(meta) {
      const mentor = meta.mentor;
      const group = meta.onboardingGroup;
      return `
        <div class="section-title">Support Network</div>
        <div class="grid">
          <section class="task-card" style="padding:14px">
            <div class="task-head">
              <div>
                <strong>${escapeHtml(mentor && mentor.name ? mentor.name : 'Not assigned yet')}</strong>
                <p class="muted" style="margin-top:3px">Assigned Mentor</p>
              </div>
              <span class="pill ${mentor ? '' : 'warn'}">${mentor ? 'Ready' : 'Pending'}</span>
            </div>
            <div class="detail-list" style="margin-top:12px">
              <div class="detail-row"><span>Department</span><strong>${escapeHtml((mentor && mentor.department) || '-')}</strong></div>
              <div class="detail-row"><span>Position</span><strong>${escapeHtml((mentor && mentor.position) || '-')}</strong></div>
              <div class="detail-row"><span>Email</span><strong>${escapeHtml((mentor && mentor.email) || '-')}</strong></div>
            </div>
          </section>
          <section class="task-card" style="padding:14px">
            <div class="task-head">
              <div>
                <strong>${escapeHtml((group && group.groupName) || 'No onboarding group')}</strong>
                <p class="muted" style="margin-top:3px">Current Cohort</p>
              </div>
              <span class="pill ${group ? '' : 'warn'}">${group ? `${group.totalMonths || 0} months` : 'Pending'}</span>
            </div>
            <div class="detail-list" style="margin-top:12px">
              <div class="detail-row"><span>Start</span><strong>${formatThaiDate(group && group.startDate)}</strong></div>
              <div class="detail-row"><span>Interval</span><strong>${escapeHtml(group && group.intervalDays ? `${group.intervalDays} days` : '-')}</strong></div>
            </div>
          </section>
        </div>
      `;
    }

    function mentorCheckpointContent(tasks) {
      const months = groupedMonthStats(tasks);
      return `
        <div class="section-title">Checkpoint Calendar</div>
        <div class="grid">
          ${months.map(item => `
            <section class="task-card" style="padding:14px">
              <div class="task-head">
                <div>
                  <strong>Month ${item.month}</strong>
                  <p class="muted" style="margin-top:3px">${item.total} checkpoint tasks</p>
                </div>
                <span class="pill ${item.percent === 100 ? '' : 'warn'}">${item.percent}%</span>
              </div>
              <div class="progress-track" style="margin-top:12px"><div class="progress-fill" style="width:${item.percent}%"></div></div>
            </section>
          `).join('')}
        </div>
      `;
    }

    function portalTabContent(role, user, tasks, options) {
      const mentees = (options.meta && options.meta.mentees) || currentPortalMeta.mentees || [];
      const meta = options.meta || currentPortalMeta || {};
      if (portalTab === 'journey') return role === 'Mentor' ? mentorCheckpointContent(tasks) : journeyContent(tasks);
      if (portalTab === 'tasks') {
        return `<div class="section-title">${role === 'Mentor' ? 'My Pending Evaluation Tasks' : 'My Pending Tasks'}</div><div class="grid">${tasks.length ? tasks.map(task => taskCard(task, role, options.preview)).join('') : '<section class="task-card" style="padding:14px"><strong>ยังไม่มีงานที่ต้องทำ</strong></section>'}</div>`;
      }
      if (portalTab === 'learning') {
        return `<div class="section-title">Learning Library</div><section class="task-card" style="padding:14px"><strong>Onboarding Materials</strong><p class="muted" style="margin-top:6px">พื้นที่นี้เตรียมไว้สำหรับคู่มือ วิดีโอ หรือเอกสารเรียนรู้ของแต่ละเดือน</p></section>`;
      }
      if (portalTab === 'mentees') {
        return mentorMenteeCards(mentees);
      }
      if (portalTab === 'profile') {
        return `
          <div class="section-title">Profile</div>
          <section class="task-card" style="padding:14px">
            <strong>${escapeHtml(user.name || user.displayName || '')}</strong>
            <div class="detail-list">
              <div class="detail-row"><span>Role</span><strong>${escapeHtml(role)}</strong></div>
              <div class="detail-row"><span>Department</span><strong>${escapeHtml(user.department || '-')}</strong></div>
              <div class="detail-row"><span>Position</span><strong>${escapeHtml(user.position || '-')}</strong></div>
              <div class="detail-row"><span>Email</span><strong>${escapeHtml(user.email || '-')}</strong></div>
            </div>
          </section>
          ${role === 'Mentee' ? menteeSupportCards(meta) : ''}
        `;
      }
      if (role === 'Mentor') {
        return `
          ${mentorSummaryCards(mentees, tasks)}
          ${mentorMenteeCards(mentees)}
          <div class="section-title">Next Actions</div>
          <div class="grid">${tasks.filter(task => task.status !== 'Completed').slice(0, 3).map(task => taskCard(task, role, options.preview)).join('') || '<section class="task-card" style="padding:14px"><strong>ยังไม่มีงานที่ต้องทำ</strong></section>'}</div>
        `;
      }
      return `
        ${menteeSupportCards(meta)}
        ${journeyContent(tasks)}
        <div class="section-title">${role === 'Mentor' ? 'Next Actions' : 'Today Tasks'}</div>
        <div class="grid">${tasks.filter(task => task.status !== 'Completed').slice(0, 2).map(task => taskCard(task, role, options.preview)).join('') || '<section class="task-card" style="padding:14px"><strong>ยังไม่มีงานที่ต้องทำ</strong></section>'}</div>
      `;
    }

    function renderPortal(user, tasks = [], options = {}) {
      currentUser = user;
      currentTasks = tasks || [];
      currentPortalMeta = options.meta || currentPortalMeta || {};
      if (user.role === 'HR' && !options.preview) {
        renderAdmin();
        return;
      }

      const role = user.role || 'Mentee';
      const pending = tasks.filter(task => task.status !== 'Completed').length;
      const completed = tasks.length - pending;
      const nextTask = tasks[0] || {};
      const heroClass = role === 'Mentor' ? 'green' : '';
      const heroTitle = role === 'Mentor' ? 'Mentor Portal' : 'Mentee Portal';
      const heroCopy = role === 'Mentor'
        ? 'ดูงานประเมิน ส่ง feedback และติดตาม mentee ที่ได้รับมอบหมาย'
        : 'ติดตาม checkpoint, session และ reflection ในเส้นทาง onboarding';

      render(`
        ${topbar(user, options.preview ? `Preview ${role}` : role)}
        <main class="app-shell">
          <div class="phone-wrap">
            <div class="phone-stage">
              <div class="phone-status"><span>LINE LIFF</span><span>Nose Tea</span></div>
              <div class="phone-page">
                ${options.preview ? `
                  <div class="preview-banner">
                    โหมด Preview สำหรับ Admin
                    <button class="secondary" id="backAdmin" style="float:right;min-height:28px;padding:4px 9px;border-radius:9px">กลับ Admin</button>
                  </div>
                ` : ''}

                <section class="mobile-hero-card ${heroClass}">
                  <div class="eyebrow">${role === 'Mentor' ? 'Certified Mentor' : 'New Hire Journey'}</div>
                  <h1>${escapeHtml(heroTitle)}</h1>
                  <p>${escapeHtml(heroCopy)}</p>
                  <div class="hero-mark">${role === 'Mentor' ? '✓' : '🗓'}</div>
                </section>

                <section class="profile-strip">
                  <div class="avatar">${escapeHtml(initials(user.name || user.displayName))}</div>
                  <div>
                    <strong>${escapeHtml(user.name || user.displayName || '')}</strong>
                    <div class="muted">${escapeHtml(user.department || '-')} · ${escapeHtml(user.position || role)}</div>
                  </div>
                </section>

                <div class="quick-cards">
                  <div class="quick-card"><span>เดือน</span><strong>${formatMonthTitle(nextTask.dueDate).replace(' ', '<br>')}</strong></div>
                  <div class="quick-card"><span>รอดำเนินการ</span><strong>${pending}</strong></div>
                  <div class="quick-card"><span>เสร็จแล้ว</span><strong>${completed}</strong></div>
                </div>
                <button class="secondary" id="openProgress" style="width:100%;margin-top:12px">ตรวจสอบ Progress</button>

                ${portalTabContent(role, user, tasks, options)}
                <div class="footer-note">Nose Tea Onboarding</div>
                ${bottomNav(role, portalTab)}
              </div>
            </div>
          </div>
        </main>
      `);

      if (options.preview) {
        document.getElementById('backAdmin').addEventListener('click', renderAdmin);
      }
      document.getElementById('openProgress').addEventListener('click', () => renderProgress(user, tasks, options));
      document.querySelectorAll('[data-portal-tab]').forEach(button => {
        button.addEventListener('click', () => {
          portalTab = button.dataset.portalTab;
          renderPortal(user, tasks, options);
        });
      });
      document.querySelectorAll('[data-task-action]').forEach(button => {
        button.addEventListener('click', () => {
          const task = tasks.find(item => item.taskId === button.dataset.taskAction);
          if (!task) return;
          renderTaskForm(user, task, options);
        });
      });
    }

    function taskCard(task, role, preview) {
      const primary = role === 'Mentor'
        ? (task.taskType === 'Feedback' ? 'ให้ Feedback' : 'เปิดงาน')
        : (task.taskType === 'Reflection' ? 'กรอก Reflection' : 'ยืนยัน');
      const typeText = task.taskType || '-';
      const heroTone = task.status === 'Pending' ? 'brown' : (role === 'Mentor' ? 'green' : '');
      const icon = typeText === 'Feedback' ? '★' : (typeText === 'Attendance' ? '✓' : '✎');
      const headline = typeText === 'Feedback'
        ? 'รอให้ Feedback'
        : (typeText === 'Attendance' ? 'ยืนยันการเข้าร่วม' : 'ถึงเวลาส่ง Reflection');
      const summaryMid = typeText === 'Attendance' ? 'เต็มวัน' : '1 งาน';
      return `
        <section class="task-card">
          <div class="request-hero ${heroTone}">
            <div class="request-icon">${escapeHtml(icon)}</div>
            <h3>${escapeHtml(headline)}</h3>
            <div class="request-tag"># ${escapeHtml(typeText)}</div>
            <div class="request-mascot">NT</div>
          </div>
          <div class="task-content">
            <div class="identity-row">
              <div class="avatar">${escapeHtml(initials(task.target || task.title))}</div>
              <div>
                <strong>${escapeHtml(task.target || (role === 'Mentor' ? 'Mentee' : 'Self'))}</strong>
                <p class="muted" style="margin-top:2px">${escapeHtml(task.title || task.taskId)}</p>
              </div>
            </div>
            <div class="task-summary-cards">
              <div class="task-summary-card"><span>ประเภท</span><strong>${escapeHtml(typeText)}</strong></div>
              <div class="task-summary-card"><span>จำนวน</span><strong>${escapeHtml(summaryMid)}</strong></div>
              <div class="task-summary-card"><span>กำหนดส่ง</span><strong>${formatThaiDate(task.dueDate)}</strong></div>
            </div>
            <div class="detail-list">
              <div class="detail-row"><span>รายละเอียด</span><strong>${escapeHtml(task.description || '-')}</strong></div>
              <div class="detail-row"><span>สถานะ</span><strong>${escapeHtml(task.status || 'Open')}</strong></div>
            </div>
            <div class="decision-actions">
              <button class="approve" data-task-action="${escapeHtml(task.taskId)}">${escapeHtml(primary)}</button>
              <button class="reject" data-task-action="${escapeHtml(task.taskId)}">ดูรายละเอียด</button>
            </div>
          </div>
        </section>
      `;
    }

    function renderProgress(user, tasks, options = {}) {
      const total = tasks.length;
      const completed = tasks.filter(task => task.status === 'Completed').length;
      const pending = total - completed;
      const percent = total ? Math.round((completed / total) * 100) : 100;
      render(`
        ${topbar(user, options.preview ? `Preview ${user.role}` : user.role)}
        <main class="app-shell">
          <section class="panel form-card">
            <div class="panel-body">
              <h2>Progress Overview</h2>
              <p class="muted" style="margin-top:4px">${escapeHtml(user.name || user.displayName || '')}</p>
              <div style="margin:18px 0 8px;display:flex;justify-content:space-between;gap:12px">
                <strong>${percent}% Complete</strong>
                <span class="muted">${completed}/${total} tasks</span>
              </div>
              <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
              <div class="quick-cards" style="margin-top:16px">
                <div class="quick-card"><span>ทั้งหมด</span><strong>${total}</strong></div>
                <div class="quick-card"><span>เสร็จแล้ว</span><strong>${completed}</strong></div>
                <div class="quick-card"><span>ค้างอยู่</span><strong>${pending}</strong></div>
              </div>
              <div class="grid" style="margin-top:16px">
                ${tasks.map(task => `
                  <div class="task-card" style="padding:14px">
                    <div class="task-head">
                      <div>
                        <strong>${escapeHtml(task.title)}</strong>
                        <p class="muted" style="margin-top:3px">${escapeHtml(task.taskType)} · ${formatThaiDate(task.dueDate)}</p>
                      </div>
                      <span class="pill ${task.status === 'Completed' ? '' : 'warn'}">${escapeHtml(task.status)}</span>
                    </div>
                  </div>
                `).join('') || '<div class="note">ยังไม่มี task สำหรับ progress</div>'}
              </div>
              <button class="secondary" id="backPortal" style="width:100%;margin-top:16px">กลับหน้าหลัก</button>
            </div>
          </section>
        </main>
      `);
      document.getElementById('backPortal').addEventListener('click', () => renderPortal(user, tasks, options));
    }

    function scoreGroup(name, label) {
      return `
        <div class="form-section">
          <strong>${escapeHtml(label)}</strong>
          <div class="score-grid">
            ${[10, 8, 6, 4, 2].map(score => `
              <label><input type="radio" name="${name}" value="${score}" required>${score}</label>
            `).join('')}
          </div>
        </div>
      `;
    }

    function renderTaskForm(user, task, options = {}) {
      const disabled = task.status === 'Completed';
      const isPreview = Boolean(options.preview);
      let formBody = '';
      if (task.taskType === 'Feedback') {
        formBody = `
          ${scoreGroup('understanding', 'Understanding')}
          ${scoreGroup('participation', 'Participation')}
          ${scoreGroup('communication', 'Communication')}
          ${scoreGroup('adaptability', 'Adaptability')}
          ${scoreGroup('responsibility', 'Responsibility')}
          <label>Comment</label>
          <textarea name="comment" placeholder="ข้อเสนอแนะเพิ่มเติม"></textarea>
        `;
      } else if (task.taskType === 'Reflection') {
        formBody = `
          <label>3 Learnings</label>
          <textarea name="learnings" required placeholder="สิ่งที่ได้เรียนรู้"></textarea>
          <label>2 Challenges</label>
          <textarea name="challenges" required placeholder="สิ่งที่ยังท้าทาย"></textarea>
          <label>1 Suggestion</label>
          <textarea name="suggestion" required placeholder="ข้อเสนอแนะ"></textarea>
          <label>Need Support</label>
          <textarea name="support" placeholder="อยากให้ทีมช่วยอะไรเพิ่มเติม"></textarea>
        `;
      } else {
        formBody = `
          <div class="note">
            ยืนยันการเข้าร่วม session นี้<br>
            วันที่: ${formatThaiDate(task.sessionDate || task.dueDate)}<br>
            เวลา: ${escapeHtml(task.startTime || '-')} - ${escapeHtml(task.endTime || '-')}<br>
            ห้อง: ${escapeHtml(task.room || '-')}
          </div>
          <input type="hidden" name="confirmed" value="yes">
        `;
      }

      render(`
        ${topbar(user, options.preview ? `Preview ${user.role}` : user.role)}
        <main class="app-shell">
          <section class="panel form-card">
            <div class="panel-body">
              <h2>${escapeHtml(task.title || 'Task')}</h2>
              <p class="muted" style="margin-top:4px">${escapeHtml(task.description || '')}</p>
              <div class="detail-list">
                <div class="detail-row"><span>ประเภท</span><strong>${escapeHtml(task.taskType)}</strong></div>
                <div class="detail-row"><span>เป้าหมาย</span><strong>${escapeHtml(task.target || 'Self')}</strong></div>
                <div class="detail-row"><span>กำหนดส่ง</span><strong>${formatThaiDate(task.dueDate)}</strong></div>
                <div class="detail-row"><span>สถานะ</span><strong>${escapeHtml(task.status)}</strong></div>
              </div>
              <form id="taskForm" class="grid" style="margin-top:16px">
                ${formBody}
                <button type="submit" ${disabled ? 'disabled' : ''}>${disabled ? 'ส่งแล้ว' : 'Submit'}</button>
                <button type="button" class="secondary" id="backPortal">กลับหน้าหลัก</button>
              </form>
            </div>
          </section>
        </main>
      `);

      document.getElementById('backPortal').addEventListener('click', () => renderPortal(user, currentTasks, options));
      document.getElementById('taskForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (isPreview) {
          alert('Preview mode: ฟอร์มนี้หน้าตาเหมือนจริง แต่ยังไม่บันทึกข้อมูล');
          return;
        }
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'กำลังบันทึก...';
        try {
          await api('/submitTask', {
            taskId: task.taskId,
            submission: Object.fromEntries(new FormData(event.currentTarget).entries())
          });
          alert('บันทึกสำเร็จ');
          const portal = await api('/getPortal');
          renderPortal(portal.user, portal.tasks || [], { meta: portal });
        } catch (error) {
          button.disabled = false;
          button.textContent = 'Submit';
          alert(error.message);
        }
      });
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
                <div class="wide-actions">
                  <button type="button" id="refreshAdmin" class="secondary">Refresh Data</button>
                </div>
              </div>
            </section>

            <div class="tabs">
              <button class="${adminActiveTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Dashboard</button>
              <button class="${adminActiveTab === 'groups' ? 'active' : ''}" data-tab="groups">Groups</button>
              <button class="${adminActiveTab === 'users' ? 'active' : ''}" data-tab="users">Users</button>
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

    function renderAdminOverview(data) {
      const summary = data.summary || {};
      const pendingQueue = data.recentQueue || [];
      const recentSessions = (data.sessions || []).slice(0, 4);
      return `
        <section class="panel" style="margin-bottom:16px">
          <div class="panel-body">
            <div class="ops-header">
              <div>
                <h2>Start Here</h2>
                <p class="muted" style="margin-top:4px">Run onboarding in this order: review users, assign group, create session, then send cards and reminders.</p>
              </div>
              <div class="ops-status">Production workflow</div>
            </div>
            <div class="ops-grid" style="margin-top:14px">
              <button type="button" class="ops-card" data-jump-tab="users">
                <span class="ops-step">Step 1</span>
                <strong>Users & Roles</strong>
                <span>Check registration, fix role, and confirm LINE is linked.</span>
              </button>
              <button type="button" class="ops-card" data-jump-tab="groups">
                <span class="ops-step">Step 2</span>
                <strong>Create Group</strong>
                <span>Build a cohort and assign mentor + mentees into one run.</span>
              </button>
              <button type="button" class="ops-card" data-jump-tab="sessions">
                <span class="ops-step">Step 3</span>
                <strong>Create Session</strong>
                <span>Set title, date, room, month number, and auto-create tasks.</span>
              </button>
              <button type="button" class="ops-card ops-card-accent" data-jump-tab="messages">
                <span class="ops-step">Step 4</span>
                <strong>Send LINE Cards</strong>
                <span>Push the correct Flex card to one person or to a whole segment.</span>
              </button>
            </div>
          </div>
        </section>

        <div class="grid stats">
          <section class="panel stat-panel" data-jump-tab="users"><div class="panel-body"><h3>Total Users</h3><div class="stat-number">${summary.totalUsers || 0}</div><p class="muted">Registered in D1</p></div></section>
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
                <h2>Action Inbox</h2>
                <p class="muted" style="margin-top:4px">The most urgent work waiting in the system right now.</p>
              </div>
              <button type="button" class="secondary" data-jump-tab="messages">Open Message Center</button>
            </div>
            <div class="ops-list" style="margin-top:14px">
              ${pendingQueue.length ? pendingQueue.map(task => `
                <div class="ops-list-item">
                  <div>
                    <strong>${escapeHtml(task.title || task.taskId)}</strong>
                    <div class="muted" style="margin-top:4px">${escapeHtml(task.taskType || 'Task')} · Due ${formatThaiDate(task.dueDate)} · Owner ${escapeHtml(renderTaskOwnerName(task, data))}</div>
                  </div>
                  <button type="button" class="secondary" data-open-task-message="${escapeHtml(task.taskId)}">Send Card</button>
                </div>
              `).join('') : '<div class="note">No pending tasks. Nice.</div>'}
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

      if (tab === 'groups') {
        const mentors = data.users.filter(user => user.role === 'Mentor');
        const mentees = data.users.filter(user => user.role === 'Mentee');
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
                  <div class="queue-card">
                    <div class="queue-head">
                      <div>
                        <strong>${escapeHtml(group.groupName)}</strong>
                        <p class="muted" style="margin-top:4px">Start: ${formatThaiDate(group.startDate)} · Every ${group.intervalDays} days · ${group.totalMonths} months</p>
                        <p class="muted" style="margin-top:4px">Members: ${(data.groupMembers || []).filter(member => member.groupId === group.groupId).length}</p>
                      </div>
                      <button type="button" class="secondary" data-assign-group="${escapeHtml(group.groupId)}" style="width:auto">Assign</button>
                    </div>
                  </div>
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
            const target = document.getElementById('groupAssignPanel');
            target.innerHTML = `
              <form id="assignGroupForm" class="inline-form grid">
                <h3>Assign Members: ${escapeHtml(group.groupName)}</h3>
                <input type="hidden" name="groupId" value="${escapeHtml(group.groupId)}">
                <label>Default Mentor</label>
                <select name="mentorUserId">
                  <option value="">No default mentor</option>
                  ${mentors.map(user => `<option value="${escapeHtml(user.userId)}">${escapeHtml(user.name || user.displayName)} (${escapeHtml(user.department)})</option>`).join('')}
                </select>
                <label>Mentees</label>
                <select name="userIds" multiple size="8" required>
                  ${mentees.map(user => `<option value="${escapeHtml(user.userId)}">${escapeHtml(user.name || user.displayName)} · ${escapeHtml(user.department)}</option>`).join('')}
                </select>
                <p class="muted">กด Ctrl/Command เพื่อเลือกหลายคน</p>
                <button type="submit">Save Members</button>
              </form>
            `;
            document.getElementById('assignGroupForm').addEventListener('submit', async event => {
              event.preventDefault();
              const form = event.currentTarget;
              const payload = {
                groupId: form.groupId.value,
                mentorUserId: form.mentorUserId.value,
                userIds: [...form.userIds.selectedOptions].map(option => option.value)
              };
              try {
                await api('/updateGroupMembers', payload);
                adminCache = null;
                alert('Members assigned');
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
            await api(formData.checkpointId ? '/updateCheckpoint' : '/createCheckpoint', formData);
            adminCache = null;
            alert('Saved');
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
            render(shell('กำลังเข้าสู่ระบบเว็บ...', '<div class="note">กำลังตรวจสอบ LINE Login</div>'));
            await completeWebLogin(code, state);
            return;
          }
          if (webSessionToken) {
            currentUser = { role: 'HR', name: 'Web Admin' };
            await renderAdmin();
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
            renderTaskForm(portal.user, task, { meta: portal });
            return;
          }
        }
        renderPortal(portal.user, portal.tasks || [], { meta: portal });
      } catch (error) {
        render(shell('เปิดระบบไม่สำเร็จ', `<div class="error">${escapeHtml(error.message)}</div>`));
      }
    }

    boot();

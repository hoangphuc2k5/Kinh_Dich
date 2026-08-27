import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, CircleHelp, Clock3, Download, LoaderCircle, Sparkles } from 'lucide-react';
import { castDateTime, castNumbers, castRandom, hexagramName, TRIGRAM_NAMES, type HexagramResult } from './lib/maiHua';
import supplement from './data/que-supplement.json';

type AnswerBlock = { type: 'heading' | 'paragraph' | 'list'; text?: string; items?: string[] };
function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []; let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push({ type: 'list', items: list }); list = []; } };
  for (const raw of text.split(/\r?\n/)) { const line = raw.trim(); if (!line) { flush(); continue; }
    const heading = line.match(/^#{1,4}\s*(.+)$/) || line.match(/^\*\*(.+)\*\*\s*$/);
    if (heading) { flush(); blocks.push({ type: 'heading', text: heading[1].replace(/\*\*/g, '') }); continue; }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/); if (bullet) { list.push(bullet[1].replace(/\*\*/g, '')); continue; }
    flush(); blocks.push({ type: 'paragraph', text: line.replace(/\*\*/g, '') });
  } flush(); return blocks;
}
function Answer({ text }: { text: string }) { return <div className="answer">{parseAnswer(text).map((block, index) => block.type === 'heading' ? <h4 className="answer-heading" key={index}>{block.text}</h4> : block.type === 'list' ? <ul className="answer-list" key={index}>{block.items?.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul> : <p key={index}>{block.text}</p>)}</div>; }
function Lines({ result, changed = false }: { result: HexagramResult; changed?: boolean }) { const lines = changed ? result.changedLines : result.lines; return <div className="lines" aria-label="Sáu hào từ dưới lên">{lines.map((yang, index) => <div className={`line ${yang ? 'yang' : 'yin'} ${!changed && index + 1 === result.movingLine ? 'moving' : ''}`} key={index}><span /><span />{!changed && index + 1 === result.movingLine && <b>{yang ? '○' : '×'}</b>}</div>)}</div>; }
function Illustration({ result, className = 'illustration' }: { result: HexagramResult; className?: string }) { return <>{<img className={className} src={`/${result.hexagramNumber}.png`} alt={`Thẻ minh họa ${hexagramName(result.hexagramNumber)}`} />}{className === 'modal-art' && <MeaningGrid number={result.hexagramNumber} />}</>; }
function MeaningGrid({ number }: { number: number }) { const record = supplement.find((item) => item.so_thu_tu === number); if (!record) return null; return <section className="meaning-grid" aria-label={`19 mục giải nghĩa ${hexagramName(number)}`}><div className="meaning-heading"><span>GIẢI NGHĨA THEO TỪNG MẶT</span><small>19 mục tham khảo</small></div>{Object.entries(record.giai_nghia).map(([label, text]) => <div className="meaning-item" key={label}><strong>{label}</strong><p>{text}</p></div>)}</section>; }
function ReadingCard({ result, index, label }: { result: HexagramResult; index: number; label?: string }) { const download = () => { const link = document.createElement('a'); link.href = `/${result.hexagramNumber}.png`; link.download = `que-${result.hexagramNumber}.png`; link.click(); }; return <article className="reading-card"><div className="card-top"><span>{label ?? `QUẺ ${String(index + 1).padStart(2, '0')}`}</span><span className="status">{result.relationship}</span></div><Illustration result={result} /><MeaningGrid number={result.hexagramNumber} /><div className="hex-pair"><div><Lines result={result} /><strong>{hexagramName(result.hexagramNumber)}</strong><small>{TRIGRAM_NAMES[result.upper]} trên · {TRIGRAM_NAMES[result.lower]} dưới</small></div><ChevronRight className="arrow" /><div><Lines result={result} changed /><strong>{hexagramName(result.changedNumber)}</strong><small>Quẻ biến</small></div></div><div className="reading-meta"><span>Thể <b>{TRIGRAM_NAMES[result.body]}</b> · {result.bodyElement}</span><span>Dụng <b>{TRIGRAM_NAMES[result.subject]}</b> · {result.subjectElement}</span><span>Hào động <b>{result.movingLine}</b></span></div><div className="card-actions"><button title="Tải thẻ minh họa PNG" onClick={download}><Download size={14} /> Tải thẻ</button><details><summary>Chi tiết kỹ thuật</summary><p>Hỗ quái: {TRIGRAM_NAMES[result.mutualUpper]} / {TRIGRAM_NAMES[result.mutualLower]}.</p></details></div></article>; }

/** Vị trí 3 quẻ: xếp thẳng hàng theo thứ tự 1, 3, 2 */
const THREE_SLOTS: { slot: number; col: number }[] = [
  { slot: 1, col: 1 }, { slot: 3, col: 2 }, { slot: 2, col: 3 },
];

/** Vị trí 7 quẻ trong lưới: 1–2 hàng trên, 3–7–4 hàng giữa, 5–6 hàng dưới */
const GRID_SLOTS: { slot: number; row: number; col: number }[] = [
  { slot: 1, row: 1, col: 1 }, { slot: 2, row: 1, col: 3 },
  { slot: 3, row: 2, col: 1 }, { slot: 7, row: 2, col: 2 }, { slot: 4, row: 2, col: 3 },
  { slot: 5, row: 3, col: 1 }, { slot: 6, row: 3, col: 3 },
];

function ReadingDetailModal({ result, title, onClose, questionId, defaultQuestion }: { result: HexagramResult; title: string; onClose: () => void; questionId: string; defaultQuestion: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const ask = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/interpret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: question.trim() || defaultQuestion, readings: [result] }) });
      const data = await response.json();
      setAnswer(data.text || data.error);
    } catch {
      setAnswer('Không thể kết nối máy chủ .');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="live-modal-backdrop" onClick={onClose}>
      <section className="live-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Đóng">×</button>
        <p className="eyebrow gold">{title}</p>
        <Illustration result={result} className="modal-art" />
        <h3>{hexagramName(result.hexagramNumber)}</h3>
        <div className="modal-facts">
          <span>Quẻ biến: <b>{hexagramName(result.changedNumber)}</b></span>
          <span>Thể: <b>{TRIGRAM_NAMES[result.body]}</b> · {result.bodyElement}</span>
          <span>Dụng: <b>{TRIGRAM_NAMES[result.subject]}</b> · {result.subjectElement}</span>
          <span>Hào động: <b>{result.movingLine}</b></span>
          <span>Hỗ quái: <b>{TRIGRAM_NAMES[result.mutualUpper]} / {TRIGRAM_NAMES[result.mutualLower]}</b></span>
        </div>
        <label htmlFor={questionId}>Câu hỏi cho AI</label>
        <textarea id={questionId} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ví dụ: Quẻ này nói gì về việc tôi đang hỏi?" />
        <button className="ask-ai" onClick={ask} disabled={loading}>{loading ? 'Đang luận giải...' : 'Hỏi'}</button>
        {answer && <Answer text={answer} />}
      </section>
    </div>
  );
}

function SpreadTile({ result, slot, center = false, onOpen }: { result: HexagramResult; slot: number; center?: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={`spread-tile image-trigger ${center ? 'center' : ''}`} onDoubleClick={onOpen} title="Nhấp đúp để xem chi tiết">
      <span className="spread-slot">{slot}</span>
      <img src={`/${result.hexagramNumber}.png`} alt={hexagramName(result.hexagramNumber)} />
    </button>
  );
}

function ThreeGridSpread({ readings }: { readings: HexagramResult[] }) {
  const [selected, setSelected] = useState<{ result: HexagramResult; slot: number } | null>(null);
  return (
    <>
      <div className="spread-overview spread-overview-wide">
        <div className="three-grid" aria-label="Ba quẻ xếp thẳng hàng theo thứ tự 1, 3, 2">
          {THREE_SLOTS.map(({ slot, col }) => (
            <div className="three-grid-cell" style={{ gridColumn: col }} key={slot}>
              <SpreadTile result={readings[slot - 1]} slot={slot} onOpen={() => setSelected({ result: readings[slot - 1], slot })} />
            </div>
          ))}
        </div>
        <p className="spread-hint">Nhấp đúp vào quẻ để xem chi tiết</p>
      </div>
      {selected && <ReadingDetailModal result={selected.result} title={`CHI TIẾT QUẺ · VỊ TRÍ ${selected.slot}`} onClose={() => setSelected(null)} questionId={`spread-q-3-${selected.slot}`} defaultQuestion="Hãy luận giải quẻ này trong bối cảnh câu hỏi hiện tại." />}
    </>
  );
}

function SevenGridSpread({ readings }: { readings: HexagramResult[] }) {
  const [selected, setSelected] = useState<{ result: HexagramResult; slot: number } | null>(null);
  return (
    <>
      <div className="spread-overview spread-overview-wide">
        <div className="seven-grid" aria-label="Bảy quẻ xếp theo thứ tự bóc">
          {GRID_SLOTS.map(({ slot, row, col }) => (
            <div className="seven-grid-cell" style={{ gridRow: row, gridColumn: col }} key={slot}>
              <SpreadTile result={readings[slot - 1]} slot={slot} center={slot === 7} onOpen={() => setSelected({ result: readings[slot - 1], slot })} />
            </div>
          ))}
        </div>
        <p className="spread-hint">Nhấp đúp vào quẻ để xem chi tiết</p>
      </div>
      {selected && <ReadingDetailModal result={selected.result} title={`CHI TIẾT QUẺ · VỊ TRÍ ${selected.slot}`} onClose={() => setSelected(null)} questionId={`spread-q-7-${selected.slot}`} defaultQuestion="Hãy luận giải quẻ này trong bối cạnh câu hỏi hiện tại." />}
    </>
  );
}

function FiveCircleSpread({ readings }: { readings: HexagramResult[] }) {
  const [selected, setSelected] = useState<{ result: HexagramResult; slot: number } | null>(null);
  return (
    <>
      <div className="spread-overview spread-overview-wide">
        <div className="circle-spread" aria-label="Năm quẻ xếp thành hình tròn">
          <div className="circle-ring" aria-hidden />
          {readings.map((result, index) => {
            const angle = -90 + index * (360 / 5);
            const radius = 46;
            const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
            const y = 50 + radius * Math.sin((angle * Math.PI) / 180);
            const slot = index + 1;
            return (
              <div className="circle-spread-item" style={{ left: `${x}%`, top: `${y}%` }} key={index}>
                <SpreadTile result={result} slot={slot} onOpen={() => setSelected({ result, slot })} />
              </div>
            );
          })}
        </div>
        <p className="spread-hint">Nhấp đúp vào quẻ để xem chi tiết</p>
      </div>
      {selected && <ReadingDetailModal result={selected.result} title={`CHI TIẾT QUẺ · VÒNG ${selected.slot}`} onClose={() => setSelected(null)} questionId={`spread-q-5-${selected.slot}`} defaultQuestion="Hãy luận giải quẻ này trong bối cảnh câu hỏi hiện tại." />}
    </>
  );
}
function LiveWidget() { const [result, setResult] = useState(() => castDateTime()); const [open, setOpen] = useState(false); const [details, setDetails] = useState(false); const [minute, setMinute] = useState(new Date().getMinutes()); const [time, setTime] = useState(new Date()); useEffect(() => { const timer = window.setInterval(() => { const now = new Date(); setTime(now); if (now.getMinutes() !== minute) { setMinute(now.getMinutes()); setResult(castDateTime(now)); } }, 5000); return () => window.clearInterval(timer); }, [minute]); return <aside className={`live-widget ${open ? 'open' : ''}`}><button className="live-toggle" onClick={() => setOpen(!open)}><Clock3 size={16} /><span>{time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} · {TRIGRAM_NAMES[result.upper]} + {TRIGRAM_NAMES[result.lower]}</span></button>{open && <div className="live-detail"><p className="eyebrow gold">QUẺ THỜI KHẮC · GIỜ VIỆT NAM</p><button className="image-trigger" onDoubleClick={() => setDetails(true)} title="Nhấp đúp để xem chi tiết"><Illustration result={result} className="live-art" /></button><Lines result={result} /><strong>{hexagramName(result.hexagramNumber)}</strong><small>Thể {TRIGRAM_NAMES[result.body]} · Dụng {TRIGRAM_NAMES[result.subject]} · Hào {result.movingLine}</small><button onClick={() => localStorage.setItem('mai-hoa-live', JSON.stringify(result))}>Lưu quẻ này</button></div>}{details && <ReadingDetailModal result={result} title="CHI TIẾT QUẺ THỜI KHẮC · GIỜ VIỆT NAM" onClose={() => setDetails(false)} questionId="live-question" defaultQuestion="Hãy luận giải quẻ thời khắc hiện tại theo hướng khí vận và điềm ứng." />}</aside>; }
export function App() { const [question, setQuestion] = useState(''); const [count, setCount] = useState(1); const [method, setMethod] = useState<'numbers' | 'random' | 'datetime'>('random'); const [numbers, setNumbers] = useState('31,14'); const [readings, setReadings] = useState<HexagramResult[]>([]); const [answer, setAnswer] = useState(''); const [loading, setLoading] = useState(false); const cast = () => { const [first, second] = numbers.split(',').map(Number); const next = Array.from({ length: count }, (_, index) => method === 'numbers' ? castNumbers((first || 1) + index, (second || 1) + index * 3) : method === 'datetime' ? castDateTime(new Date(Date.now() + index * 60000)) : castRandom()); setReadings(next); setAnswer(''); }; const interpret = async () => { if (!question.trim() || !readings.length) return; setLoading(true); try { const payload = readings.map((r) => ({ hexagramNumber: r.hexagramNumber, changedNumber: r.changedNumber, movingLine: r.movingLine, body: r.body, subject: r.subject, bodyElement: r.bodyElement, subjectElement: r.subjectElement, relationship: r.relationship })); const response = await fetch('/api/interpret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, readings: payload }) }); const data = await response.json(); setAnswer(data.text || data.error); } catch { setAnswer('Không thể kết nối máy chủ. Hãy khởi động API bằng npm run server.'); } finally { setLoading(false); } }; return <main><LiveWidget /><header><div className="brand-mark">☰</div><div><p className="eyebrow">THƯ PHÒNG DỊCH LÝ · GIỜ VIỆT NAM</p><h1>Mai Hoa <em>Dịch Số</em></h1></div><CircleHelp size={19} /></header><section className="hero"><div><p className="eyebrow gold">MỘT CÂU HỎI · VẠN BIẾN HÓA</p><h2>Gieo một quẻ,<br /><i>soi một đường đi.</i></h2><p className="intro">Nghiên cứu Mai Hoa Dịch Số qua những con số đang hiện diện, với lời giải bám sát nguyên lý và văn bản kinh điển.</p></div><div className="seal">Dịch<br /><small>Đạo</small></div></section><section className="panel"><label htmlFor="question">Câu hỏi của bạn</label><textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Bạn đang muốn soi chiếu điều gì?" /><div className="controls"><div><label>Số quẻ</label><div className="segmented">{[1, 2, 3, 5, 7].map((value) => <button className={count === value ? 'selected' : ''} onClick={() => setCount(value)} key={value}>{value}</button>)}</div></div><div><label>Phương pháp lấy số</label><select value={method} onChange={(event) => setMethod(event.target.value as typeof method)}><option value="random">Bốc số ảo</option><option value="datetime">Ngày giờ</option><option value="numbers">Số báo tùy ý</option></select></div>{method === 'numbers' && <div><label>Hai số báo</label><input value={numbers} onChange={(event) => setNumbers(event.target.value)} placeholder="31, 14" /></div>}<button className="cast" onClick={cast}><Sparkles size={17} /> Gieo quẻ</button></div></section>{readings.length > 0 && <section className="results"><div className="section-heading"><div><p className="eyebrow gold">KẾT QUẢ HIỆN LỘ</p><h3>{readings.length} quẻ cho câu hỏi này</h3></div><span className="source-note"><BookOpen size={15} /> Nguồn sách đã nạp</span></div>{readings.length === 3 && <ThreeGridSpread readings={readings} />}{readings.length === 7 && <SevenGridSpread readings={readings} />}{readings.length === 5 && <FiveCircleSpread readings={readings} />}
{readings.length !== 3 && readings.length !== 5 && readings.length !== 7 && <div className="card-grid">{readings.map((result, index) => <ReadingCard result={result} index={index} key={`${result.hexagramNumber}-${index}`} />)}</div>}<div className="interpret"><div><p className="eyebrow gold">LUẬN GIẢI</p><h3>Đọc mạch quẻ</h3></div><button className="interpret-button" onClick={interpret} disabled={loading || !question.trim()}>{loading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} {loading ? 'Đang thỉnh lời giải...' : 'Gọi AI luận giải'}</button>{answer && <Answer text={answer} />}</div></section>}<footer>Gieo quẻ là một phương tiện chiêm nghiệm. Lời giải chỉ mang tính tham khảo, quyết định sau cùng vẫn thuộc về bạn.</footer></main>; }

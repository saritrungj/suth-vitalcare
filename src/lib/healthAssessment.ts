// 3อ2ส health assessment definition + scoring, extracted from Health.vue so
// the admin editor (AssessmentsTab.vue) scores identically to the user flow.
// Pure — unit-tested via scripts/health-assessment.test.ts.

export interface Option {
  text: string;
  score: number;
  shortLabel: string;
}
export interface Question {
  id: string;
  text: string;
  isList?: boolean;
  options: Option[];
}
export interface ScoringRange {
  min: number;
  max: number;
  level: string;
  desc: string;
  advice: string;
}
export interface Section {
  id: string;
  label: string;
  shortLabel: string;
  questions: Question[];
  maxScore: number;
  scoringRanges: ScoringRange[];
  layout: "grid" | "list";
  gridHeaders?: string[];
}
// ─── ข้อมูลแบบประเมินอิงตามไฟล์ PDF ───
export const sections: Section[] = [
  {
    id: "food",
    label: "1. พฤติกรรมการบริโภคอาหาร",
    shortLabel: "อาหาร",
    maxScore: 40,
    layout: "grid",
    gridHeaders: ["ทุกวัน", "5-6 วัน", "3-4 วัน", "1-2 วัน", "ไม่ปฏิบัติ"],
    scoringRanges: [
      {
        min: 8,
        max: 15,
        level: "ควรปรับปรุง",
        desc: "มีพฤติกรรมการบริโภคอาหารไม่ถูกต้อง",
        advice:
          "ควรเริ่มปรับลดอาหารหวาน มัน เค็ม และเพิ่มผักผลไม้ให้ได้วันละ 5 กำมือ",
      },
      {
        min: 16,
        max: 23,
        level: "พอใช้",
        desc: "มีพฤติกรรมการบริโภคอาหารได้ถูกต้องเป็นส่วนใหญ่ แต่ไม่สม่ำเสมอ",
        advice: "ดีแล้ว แต่ลองตั้งเป้าให้ทำได้สม่ำเสมอขึ้น โดยเฉพาะวันหยุด",
      },
      {
        min: 24,
        max: 31,
        level: "ดี",
        desc: "มีพฤติกรรมการบริโภคอาหารถูกต้องเป็นส่วนใหญ่ อย่างสม่ำเสมอ",
        advice: "รักษาระดับนี้ไว้ และลองเพิ่มความหลากหลายของผักผลไม้สีต่าง ๆ",
      },
      {
        min: 32,
        max: 40,
        level: "ดีมาก",
        desc: "มีพฤติกรรมการบริโภคอาหารได้อย่างถูกต้อง และสม่ำเสมอ",
        advice: "ยอดเยี่ยม! คุณดูแลอาหารการกินได้อย่างถูกต้องและสม่ำเสมอ",
      },
    ],
    questions: [
      {
        id: "f1",
        text: "1) ท่านกินอาหารที่ปรุงสุกและสะอาด บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "f2",
        text: "2) ท่านกินอาหารครบ 5 หมู่อย่างหลากหลาย ในสัดส่วนที่เหมาะสม โดยใน 1 มื้อ มีข้าว-แป้ง เนื้อสัตว์ ไขมัน ผักและผลไม้ บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "f3",
        text: "3) ท่านกินผักและผลไม้ รวมกันอย่างน้อยวันละ 5 กำมือ (400 กรัม) บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "f4",
        text: "4) ท่านกินขนมหวาน เช่น ขนมเค้ก ช็อกโกแลต ไอศกรีม เป็นต้น หรือดื่มเครื่องดื่มรสหวาน (ผสมน้ำตาล น้ำเชื่อม นมข้น) บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
        ],
      },
      {
        id: "f5",
        text: "5) ท่านกินอาหารมัน เช่น ข้าวขาหมู ข้าวมันไก่ แกงกะทิ เป็นต้น บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
        ],
      },
      {
        id: "f6",
        text: "6) ท่านกินอาหารเค็มหรือปรุงรสเค็ม เช่น ไส้กรอก ขนมกรุบกรอบ เป็นต้น บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
        ],
      },
      {
        id: "f7",
        text: "7) ท่านกินอาหารแปรรูป อาหารทอด ปิ้งย่าง อาหารใส่สี เช่น ไก่ทอด หมูทอด เนื้อย่างรมควัน เป็นต้น บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
        ],
      },
      {
        id: "f8",
        text: "8) ท่านดื่มน้ำสะอาด วันละ 6 - 8 แก้ว บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
    ],
  },
  {
    id: "exercise",
    label: "2. พฤติกรรมการออกกำลังกาย",
    shortLabel: "ออกกำลังกาย",
    maxScore: 11,
    layout: "grid",
    gridHeaders: ["ทุกวัน", "5-6 วัน", "3-4 วัน", "1-2 วัน", "ไม่ปฏิบัติ"],
    scoringRanges: [
      {
        min: 3,
        max: 4,
        level: "ควรปรับปรุง",
        desc: "มีพฤติกรรมการออกกำลังกายไม่เพียงพอ",
        advice:
          "ลองเริ่มจากการลุกเดินทุก 2 ชั่วโมง แล้วค่อย ๆ เพิ่มเป็นออกกำลังกาย 30 นาทีต่อวัน",
      },
      {
        min: 5,
        max: 6,
        level: "พอใช้",
        desc: "มีพฤติกรรมการออกกำลังกายเพียงพอเป็นส่วนใหญ่ แต่ไม่สม่ำเสมอ",
        advice:
          "ดีแล้ว ลองตั้งเวลาออกกำลังกายให้แน่นอน เช่น ทุกเช้าหลังตื่นนอน",
      },
      {
        min: 7,
        max: 8,
        level: "ดี",
        desc: "มีพฤติกรรมการออกกำลังกายเพียงพอเป็นส่วนใหญ่ อย่างสม่ำเสมอ",
        advice:
          "รักษาระดับนี้ไว้ และเพิ่มการฝึกความแข็งแรงกล้ามเนื้อให้ครบ 2–3 วันต่อสัปดาห์",
      },
      {
        min: 9,
        max: 13,
        level: "ดีมาก",
        desc: "มีพฤติกรรมการออกกำลังกายได้อย่างเพียงพอ และสม่ำเสมอ",
        advice: "ยอดเยี่ยม! คุณมีวินัยการออกกำลังกายที่ดีมาก",
      },
    ],
    questions: [
      {
        id: "e1",
        text: "1) ท่านลุกขยับร่างกายทุก 2 ชั่วโมง ระหว่างทำงานหรือระหว่างวัน บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "e2",
        text: "2) ท่านออกกำลังกายจนรู้สึกหัวใจเต้นเร็วขึ้น หรือหายใจแรงขึ้นกว่าปกติ สะสมวันละ 30 นาที บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 4 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "e3",
        text: "3) ท่านฝึกสร้างความเข็งแรงของกล้ามเนื้อ เช่น ดันพื้น ดันกำแพง ลุกนั่ง เป็นต้น บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 2 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 2 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
    ],
  },
  {
    id: "emotion",
    label: "3. พฤติกรรมการจัดการอารมณ์",
    shortLabel: "อารมณ์",
    maxScore: 30,
    layout: "grid",
    gridHeaders: ["ทุกวัน", "5-6 วัน", "3-4 วัน", "1-2 วัน", "ไม่ปฏิบัติ"],
    scoringRanges: [
      {
        min: 6,
        max: 11,
        level: "ควรปรับปรุง",
        desc: "มีพฤติกรรมการจัดการอารมณ์ตนเองที่ไม่ถูกต้อง",
        advice:
          "ลองเริ่มจากการสังเกตอารมณ์ตนเองแต่ละวัน และหากิจกรรมผ่อนคลายที่ชอบ 1 อย่าง",
      },
      {
        min: 12,
        max: 17,
        level: "พอใช้",
        desc: "มีพฤติกรรมการจัดการอารมณ์ตนเองได้ถูกต้อง เป็นส่วนใหญ่ แต่ไม่สม่ำเสมอ",
        advice:
          "ดีแล้ว ลองจัดตารางเวลาส่วนตัวและพักผ่อนให้เพียงพออย่างสม่ำเสมอ",
      },
      {
        min: 18,
        max: 23,
        level: "ดี",
        desc: "มีพฤติกรรมการจัดการอารมณ์ตนเองได้ถูกต้อง เป็นส่วนใหญ่ อย่างสม่ำเสมอ",
        advice:
          "รักษาระดับนี้ไว้ และอาจลองฝึกสติหรือการหายใจเพื่อเสริมความแข็งแกร่งทางจิต",
      },
      {
        min: 24,
        max: 30,
        level: "ดีมาก",
        desc: "มีพฤติกรรมการจัดการอารมณ์ตนเองได้อย่างถูกต้อง และสม่ำเสมอ",
        advice: "ยอดเยี่ยม! สุขภาพจิตของคุณอยู่ในระดับที่ดีมาก",
      },
    ],
    questions: [
      {
        id: "m1",
        text: "1) ท่านสังเกตอารมณ์ หรือความรู้สึกของตนเองในแต่ละวันบ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "m2",
        text: "2) ท่านมีวิธีผ่อนคลาย เมื่อรู้สึกเครียด หรือไม่สบายใจ เช่น เล่นกีฬา ฟังเพลง ดูภาพยนตร์ เป็นต้น บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "m3",
        text: "3) ท่านทำกิจกรรมที่ทำให้จิตใจร่าเริงอยู่เสมอ เช่น พูดคุย กับเพื่อน ทำงานอดิเรก เลี้ยงสัตว์ ร้องเพลง เป็นต้น บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "m4",
        text: "4) ท่านสามารถจัดเวลาให้เพียงพอในเรื่อง การทำงาน ชีวิตส่วนตัว และครอบครัว บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "m5",
        text: "5) ท่านนอนหลับ วันละ 7 - 8 ชั่วโมง บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
      {
        id: "m6",
        text: "6) เมื่อท่านเจอสถานการณ์ที่ก่อให้เกิดความเครียด เช่น การทะเลาะเบาะแว้ง หรือขัดแย้งกัน ท่านสามารถ หลีกเลี่ยงได้ บ่อยเพียงใด",
        isList: true,
        options: [
          {
            text: "ทุกครั้ง หรือไม่เคยเจอสถานการณ์",
            shortLabel: "ทุกครั้ง/ไม่เคย",
            score: 5,
          },
          { text: "บ่อยครั้ง", shortLabel: "บ่อยครั้ง", score: 4 },
          { text: "บางครั้ง", shortLabel: "บางครั้ง", score: 3 },
          { text: "นานๆ ครั้ง", shortLabel: "นานๆ ครั้ง", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
    ],
  },
  {
    id: "smoke",
    label: "4. พฤติกรรมการไม่สูบบุหรี่",
    shortLabel: "บุหรี่",
    maxScore: 12,
    layout: "list",
    scoringRanges: [
      {
        min: 3,
        max: 4,
        level: "ควรปรับปรุง",
        desc: "มีพฤติกรรมไม่ถูกต้องในการป้องกันตนเอง ไม่สูบบุหรี่ บุหรี่ไฟฟ้าหรือได้รับควันบุหรี่",
        advice:
          "หากสูบอยู่ ขอแนะนำให้ปรึกษาแพทย์เพื่อเลิกบุหรี่ และหลีกเลี่ยงกลุ่มคนที่สูบ",
      },
      {
        min: 5,
        max: 6,
        level: "พอใช้",
        desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่สูบบุหรี่ บุหรี่ไฟฟ้า หรือได้รับควันบุหรี่เป็นส่วนน้อย",
        advice: "ดีแล้ว พยายามหลีกเลี่ยงพื้นที่ที่มีควันบุหรี่ให้ได้มากขึ้น",
      },
      {
        min: 7,
        max: 9,
        level: "ดี",
        desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่สูบบุหรี่ บุหรี่ไฟฟ้า หรือได้รับควันบุหรี่เป็นส่วนใหญ่",
        advice: "รักษาระดับนี้ไว้ และสนับสนุนคนรอบข้างให้เลิกบุหรี่ด้วย",
      },
      {
        min: 10,
        max: 12,
        level: "ดีมาก",
        desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่สูบบุหรี่ บุหรี่ไฟฟ้า หรือได้รับควันบุหรี่สม่ำเสมอ",
        advice: "ยอดเยี่ยม! คุณดูแลตนเองได้ดีมากในด้านนี้",
      },
    ],
    questions: [
      {
        id: "s1",
        text: "1) ท่านสูบบุหรี่ หรือ บุหรี่ไฟฟ้า หรือไม่",
        options: [
          { text: "สูบ", shortLabel: "สูบ", score: 1 },
          { text: "ไม่สูบ", shortLabel: "ไม่สูบ", score: 5 },
        ],
      },
      {
        id: "s2",
        text: "2) ในช่วง 1 สัปดาห์ที่ผ่านมา ท่านอยู่ใกล้ชิดหรือรวมกลุ่มกับผู้ที่สูบบุหรี่ หรือบุหรี่ไฟฟ้า บ่อยเพียงใด",
        options: [
          { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
          { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
          { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
        ],
      },
    ],
  },
  {
    id: "alcohol",
    label: "5. พฤติกรรมการไม่ดื่มเครื่องดื่มที่มีแอลกอฮอล์",
    shortLabel: "สุรา",
    maxScore: 15,
    layout: "list",
    scoringRanges: [
      {
        min: 3,
        max: 5,
        level: "ควรปรับปรุง",
        desc: "มีพฤติกรรมไม่ถูกต้องในการป้องกันตนเอง ไม่ดื่มสุรา หรือเครื่องดื่มที่มีแอลกอฮอล์",
        advice:
          "ขอแนะนำให้ลดปริมาณและความถี่ในการดื่ม และฝึกปฏิเสธเมื่อถูกชักชวน",
      },
      {
        min: 6,
        max: 8,
        level: "พอใช้",
        desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่ดื่มสุรา หรือเครื่องดื่มที่มีแอลกอฮอล์เป็นส่วนน้อย",
        advice: "ดีแล้ว ลองตั้งกติกาให้ตนเองในการดื่มในโอกาสพิเศษเท่านั้น",
      },
      {
        min: 9,
        max: 11,
        level: "ดี",
        desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่ดื่มสุรา หรือเครื่องดื่มที่มีแอลกอฮอล์เป็นส่วนใหญ่",
        advice: "รักษาระดับนี้ไว้ และช่วยสนับสนุนคนรอบข้างให้ลดการดื่มด้วย",
      },
      {
        min: 12,
        max: 15,
        level: "ดีมาก",
        desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่ดื่มสุรา หรือเครื่องดื่มที่มีแอลกอฮอล์อย่างสม่ำเสมอ",
        advice: "ยอดเยี่ยม! คุณดูแลตนเองได้ดีมากในด้านนี้",
      },
    ],
    questions: [
      {
        id: "a1",
        text: "1) ในช่วง 1 เดือนที่ผ่านมา ท่านดื่มสุราหรือเครื่องดื่มแอลกอฮอร์ บ่อยเพียงใด",
        options: [
          {
            text: "4 ครั้งขึ้นไปต่อสัปดาห์",
            shortLabel: "4+ ครั้ง/สัปดาห์",
            score: 1,
          },
          {
            text: "2-3 ครั้งต่อสัปดาห์",
            shortLabel: "2-3 ครั้ง/สัปดาห์",
            score: 2,
          },
          {
            text: "2-4 ครั้งต่อเดือน",
            shortLabel: "2-4 ครั้ง/เดือน",
            score: 3,
          },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
          { text: "ไม่ดื่ม", shortLabel: "ไม่ดื่ม", score: 5 },
        ],
      },
      {
        id: "a2",
        text: "2) ในช่วง 1 เดือนที่ผ่านมา ท่านอยู่ใกล้ชิดหรือรวมกลุ่มกับผู้ที่ดื่มสุรา หรือเครื่องดื่มแอลกอฮอล์ บ่อยเพียงใด",
        options: [
          {
            text: "4 ครั้งขึ้นไปต่อสัปดาห์",
            shortLabel: "4+ ครั้ง/สัปดาห์",
            score: 1,
          },
          {
            text: "2-3 ครั้งต่อสัปดาห์",
            shortLabel: "2-3 ครั้ง/สัปดาห์",
            score: 2,
          },
          {
            text: "2-4 ครั้งต่อเดือน",
            shortLabel: "2-4 ครั้ง/เดือน",
            score: 3,
          },
          { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
        ],
      },
      {
        id: "a3",
        text: "3) ท่านปฏิเสธเมื่อถูกชักชวนให้ดื่มสุราหรือเครื่องดื่มที่มีแอลกอฮอล์จากเพื่อน ครอบครัว และบุคคลใกล้ชิดบ่อยเพียงใด",
        options: [
          {
            text: "ทุกครั้ง หรือไม่เคยถูกชักชวน",
            shortLabel: "ทุกครั้ง",
            score: 5,
          },
          { text: "บ่อยครั้ง", shortLabel: "บ่อยครั้ง", score: 4 },
          { text: "บางครั้ง", shortLabel: "บางครั้ง", score: 3 },
          { text: "นานๆครั้ง", shortLabel: "นานๆครั้ง", score: 2 },
          { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
        ],
      },
    ],
  },
];

/** Sum the scores of the selected options for one section. */
export function scoreSection(
  section: Section,
  answers: Record<string, string>,
): number {
  let score = 0;
  for (const q of section.questions) {
    const opt = q.options.find((o) => o.text === answers[q.id]);
    if (opt) score += opt.score;
  }
  return score;
}

/** The scoring range a section score falls into (last range as fallback). */
export function levelForSection(section: Section, score: number): ScoringRange {
  return (
    section.scoringRanges.find((r) => score >= r.min && score <= r.max) ||
    section.scoringRanges[section.scoringRanges.length - 1]
  );
}

/** Overall level = the worst section level present. Mirrors Health.vue. */
export function overallLevelFromSectionLevels(levels: string[]): string {
  if (levels.includes("ควรปรับปรุง")) return "ควรปรับปรุง";
  if (levels.includes("พอใช้")) return "พอใช้";
  if (levels.includes("ดี")) return "ดี";
  return "ดีมาก";
}

/** Total across all sections. */
export function totalScore(answers: Record<string, string>): number {
  return sections.reduce((t, s) => t + scoreSection(s, answers), 0);
}

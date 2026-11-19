// 77 จังหวัด แบ่งตาม 6 ภูมิภาค (ราชบัณฑิตยสภา) พร้อมชื่อภาษาอังกฤษ
export const REGIONS = [
  { id: 'north', th: 'ภาคเหนือ', en: 'North', list: [
    ['เชียงราย', 'Chiang Rai'], ['เชียงใหม่', 'Chiang Mai'], ['น่าน', 'Nan'], ['พะเยา', 'Phayao'], ['แพร่', 'Phrae'],
    ['แม่ฮ่องสอน', 'Mae Hong Son'], ['ลำปาง', 'Lampang'], ['ลำพูน', 'Lamphun'], ['อุตรดิตถ์', 'Uttaradit'],
  ] },
  { id: 'northeast', th: 'ภาคอีสาน', en: 'Northeast', list: [
    ['กาฬสินธุ์', 'Kalasin'], ['ขอนแก่น', 'Khon Kaen'], ['ชัยภูมิ', 'Chaiyaphum'], ['นครพนม', 'Nakhon Phanom'],
    ['นครราชสีมา', 'Nakhon Ratchasima'], ['บึงกาฬ', 'Bueng Kan'], ['บุรีรัมย์', 'Buri Ram'], ['มหาสารคาม', 'Maha Sarakham'],
    ['มุกดาหาร', 'Mukdahan'], ['ยโสธร', 'Yasothon'], ['ร้อยเอ็ด', 'Roi Et'], ['เลย', 'Loei'], ['ศรีสะเกษ', 'Si Sa Ket'],
    ['สกลนคร', 'Sakon Nakhon'], ['สุรินทร์', 'Surin'], ['หนองคาย', 'Nong Khai'], ['หนองบัวลำภู', 'Nong Bua Lam Phu'],
    ['อำนาจเจริญ', 'Amnat Charoen'], ['อุดรธานี', 'Udon Thani'], ['อุบลราชธานี', 'Ubon Ratchathani'],
  ] },
  { id: 'central', th: 'ภาคกลาง', en: 'Central', list: [
    ['กรุงเทพมหานคร', 'Bangkok'], ['กำแพงเพชร', 'Kamphaeng Phet'], ['ชัยนาท', 'Chai Nat'], ['นครนายก', 'Nakhon Nayok'],
    ['นครปฐม', 'Nakhon Pathom'], ['นครสวรรค์', 'Nakhon Sawan'], ['นนทบุรี', 'Nonthaburi'], ['ปทุมธานี', 'Pathum Thani'],
    ['พระนครศรีอยุธยา', 'Phra Nakhon Si Ayutthaya'], ['พิจิตร', 'Phichit'], ['พิษณุโลก', 'Phitsanulok'],
    ['เพชรบูรณ์', 'Phetchabun'], ['ลพบุรี', 'Lop Buri'], ['สมุทรปราการ', 'Samut Prakan'], ['สมุทรสงคราม', 'Samut Songkhram'],
    ['สมุทรสาคร', 'Samut Sakhon'], ['สิงห์บุรี', 'Sing Buri'], ['สุโขทัย', 'Sukhothai'], ['สุพรรณบุรี', 'Suphan Buri'],
    ['สระบุรี', 'Saraburi'], ['อ่างทอง', 'Ang Thong'], ['อุทัยธานี', 'Uthai Thani'],
  ] },
  { id: 'east', th: 'ภาคตะวันออก', en: 'East', list: [
    ['จันทบุรี', 'Chanthaburi'], ['ฉะเชิงเทรา', 'Chachoengsao'], ['ชลบุรี', 'Chon Buri'], ['ตราด', 'Trat'],
    ['ปราจีนบุรี', 'Prachin Buri'], ['ระยอง', 'Rayong'], ['สระแก้ว', 'Sa Kaeo'],
  ] },
  { id: 'west', th: 'ภาคตะวันตก', en: 'West', list: [
    ['กาญจนบุรี', 'Kanchanaburi'], ['ตาก', 'Tak'], ['ประจวบคีรีขันธ์', 'Prachuap Khiri Khan'], ['เพชรบุรี', 'Phetchaburi'],
    ['ราชบุรี', 'Ratchaburi'],
  ] },
  { id: 'south', th: 'ภาคใต้', en: 'South', list: [
    ['กระบี่', 'Krabi'], ['ชุมพร', 'Chumphon'], ['ตรัง', 'Trang'], ['นครศรีธรรมราช', 'Nakhon Si Thammarat'],
    ['นราธิวาส', 'Narathiwat'], ['ปัตตานี', 'Pattani'], ['พังงา', 'Phang Nga'], ['พัทลุง', 'Phatthalung'], ['ภูเก็ต', 'Phuket'],
    ['ยะลา', 'Yala'], ['ระนอง', 'Ranong'], ['สงขลา', 'Songkhla'], ['สตูล', 'Satun'], ['สุราษฎร์ธานี', 'Surat Thani'],
  ] },
];

export const PROVINCE_INFO = {};
for (const r of REGIONS) for (const [th, en] of r.list) PROVINCE_INFO[th] = { en, region: r.id };

export const PROVINCES = Object.keys(PROVINCE_INFO).sort((a, b) => a.localeCompare(b, 'th'));

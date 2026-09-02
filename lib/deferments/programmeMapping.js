function normalizeProgramme(raw) {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, "and")
    .replace(/[-–]?\s*trans(fer)?\.?\s*$/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROGRAMME_MAP = {
  "artisan in health support service": "Artisan in Health Support Service",
  "certificate in healthcare support assistant": "Certificate in Healthcare Support Assistant",
  "certificate in healthcare support sevices": "Certificate in Healthcare Support Assistant",
  "certificate in health support assistant": "Certificate in Healthcare Support Assistant",
  "certificate in healthcare support assistant upgrading to hss level 5": "Certificate in Healthcare Support Assistant",
  "certificate in biomedical engineering technology": "Certificate in Biomedical Engineering Technology",
  "certificate in food and beverage production service and sales": "Certificate in Food & Beverage Production, Service and Sales",
  "certificate in community development and social work": "Certificate in Social Work and Community Development",
  "certificate in social work": "Certificate in Social Work and Community Development",
  "certificate in community health": "Certificate in Community Health",
  "certificate in community health and development": "Certificate in Community Health",
  "certificate in community health development": "Certificate in Community Health",
  "certificate in counselling psychology": "Certificate in Counselling Psychology",
  "certificate food science and processing technology": "Certificate in Food Science and Processing Technology",
  "care giver": "Caregiving Level 4",
  "certificate in human nutrition and dietetics": "Certificate in Human Nutrition and Dietetics",
  "certificate in nutrition and dietetics": "Certificate in Human Nutrition and Dietetics",
  "certificate in health records and information technology": "Certificate in Health Records & Information Technology",
  "certificate in information technology": "Certificate in Information Technology",
  "computer packages": "Computer Packages",
  "phebotomy": "Phlebotomy",
  "certificate in perioperative theatre technology": "Certificate in Perioperative Theatre Technology",
  "certificate in preoperative theater technology": "Certificate in Perioperative Theatre Technology",
  "certificate in science laboratory technology": "Certificate in Science Laboratory Technology",
  "diploma in aplied biology": "Diploma in Applied Biology",
  "diploma in applied biology": "Diploma in Applied Biology",
  "diploma in biomedical engineering technology": "Diploma in Biomedical Engineering Technology",
  "diploma in community development and social work": "Diploma in Social Work and Community Development",
  "diploma in social work and community health": "Diploma in Social Work and Community Development",
  "diploma in community health": "Diploma in Community Health",
  "diploma in community health assistant": "Diploma in Community Health",
  "diploma in community health assistance": "Diploma in Community Health",
  "diploma in community health and development": "Diploma in Community Health",
  "diploma in community health and hivaids management": "Diploma in Community Health",
  "diploma in clinical medicine and surgery": "Diploma in Clinical Medicine and Surgery",
  "diploma in counselling psychology": "Diploma in Counselling Psychology",
  "diploma in environmental science": "Diploma in Environmental Science",
  "diploma in food production culinary arts": "Diploma in Food Production (Culinary Arts)",
  "diploma food science and processing technology": "Diploma in Food Science and Processing Technology",
  "diploma in food processing technology": "Diploma in Food Science and Processing Technology",
  "diploma in human nutrition and dietetics": "Diploma in Human Nutrition and Dietetics",
  "diploma in nutrition and dietetic": "Diploma in Human Nutrition and Dietetics",
  "diploma in health records and information technology": "Diploma in Health Records and Information Technology",
  "diploma in health records and it": "Diploma in Health Records and Information Technology",
  "diploma in information technology": "Diploma in Information Technology",
  "diploma in medical engineering": "Diploma in Medical Engineering",
  "diploma in kenya registered community health nursing": "Diploma in Kenya Registered Community Health Nursing",
  "diploma in physiotheraphy": "Diploma in Physiotherapy",
  "diploma in perioperative theatre technology": "Diploma in Perioperative Theatre Technology",
  "diploma in science labaratory technology": "Diploma in Science Laboratory Technology",
  "diploma in science laboratory technology": "Diploma in Science Laboratory Technology",
  "intergrated management of malnutrition": "Integrated Management of Malnutrition",
  "nursing skills": "Nursing Skills",
  "peer counselling": "Peer Counselling",
};

export function mapProgrammeName(rawFromSheet) {
  const key = normalizeProgramme(rawFromSheet);
  return PROGRAMME_MAP[key] || null;
}
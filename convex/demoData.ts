// Demo data shared by seed.ts and scenario.ts. No Convex functions here.
// NOTE: facilities, bed counts and doctors are FICTIONAL demo data.
// Kalaburagi coordinates are APPROXIMATE: open the map and adjust if a pin looks off.

export type City = "bengaluru" | "kalaburagi";

export const CITY_CENTER: Record<
	City,
	{ lat: number; lng: number; label: string }
> = {
	bengaluru: { lat: 12.9716, lng: 77.5946, label: "Bengaluru" },
	kalaburagi: { lat: 17.3297, lng: 76.8343, label: "Kalaburagi" },
};

export type HospitalSeed = {
	name: string;
	city: City;
	lat: number;
	lng: number;
	facilities: string[];
	totalBeds: number;
	availableBeds: number;
	erHeadName: string;
};

export const HOSPITALS: HospitalSeed[] = [
	// ---- Bengaluru ----
	{
		name: "Manipal Hospital, Old Airport Rd",
		city: "bengaluru",
		lat: 12.9581,
		lng: 77.6484,
		facilities: [
			"trauma",
			"neuro",
			"icu",
			"ventilator",
			"cardiac",
			"orthopedic",
		],
		totalBeds: 40,
		availableBeds: 6,
		erHeadName: "Dr. Anita Rao",
	},
	{
		name: "Fortis Hospital, Bannerghatta Rd",
		city: "bengaluru",
		lat: 12.8893,
		lng: 77.5972,
		facilities: ["trauma", "cardiac", "icu", "ventilator", "burns_unit"],
		totalBeds: 35,
		availableBeds: 3,
		erHeadName: "Dr. Suresh Iyer",
	},
	{
		name: "St. John's Medical College Hospital",
		city: "bengaluru",
		lat: 12.9279,
		lng: 77.6271,
		facilities: ["trauma", "orthopedic", "maternity", "blood_bank"],
		totalBeds: 50,
		availableBeds: 10,
		erHeadName: "Dr. Meera Joseph",
	},
	{
		name: "Victoria Hospital (Govt.)",
		city: "bengaluru",
		lat: 12.9634,
		lng: 77.5733,
		facilities: ["trauma", "icu", "ventilator", "antivenom", "blood_bank"],
		totalBeds: 60,
		availableBeds: 14,
		erHeadName: "Dr. Ramesh Gowda",
	},
	{
		name: "Sakra World Hospital",
		city: "bengaluru",
		lat: 12.9279,
		lng: 77.6837,
		facilities: ["neuro", "cardiac", "icu", "ventilator", "orthopedic"],
		totalBeds: 30,
		availableBeds: 2,
		erHeadName: "Dr. Kavya Nair",
	},
	// ---- Kalaburagi (approximate positions, fictional capabilities) ----
	{
		name: "Basaveshwar Teaching & General Hospital",
		city: "kalaburagi",
		lat: 17.3196,
		lng: 76.8357,
		facilities: ["trauma", "icu", "ventilator", "blood_bank", "orthopedic"],
		totalBeds: 40,
		availableBeds: 8,
		erHeadName: "Dr. Shivakumar Patil",
	},
	{
		name: "KBN Teaching & General Hospital",
		city: "kalaburagi",
		lat: 17.3342,
		lng: 76.8479,
		facilities: [
			"trauma",
			"cardiac",
			"neuro",
			"icu",
			"ventilator",
			"maternity",
		],
		totalBeds: 30,
		availableBeds: 5,
		erHeadName: "Dr. Farah Siddiqui",
	},
	{
		name: "ESIC Medical College & Hospital",
		city: "kalaburagi",
		lat: 17.356,
		lng: 76.812,
		facilities: ["trauma", "orthopedic", "burns_unit", "blood_bank"],
		totalBeds: 25,
		availableBeds: 6,
		erHeadName: "Dr. Ravi Kulkarni",
	},
	{
		name: "District Government Hospital",
		city: "kalaburagi",
		lat: 17.329,
		lng: 76.826,
		facilities: ["trauma", "antivenom", "blood_bank", "icu"],
		totalBeds: 50,
		availableBeds: 12,
		erHeadName: "Dr. Anjali Deshmukh",
	},
];

export const DOCTORS: Record<string, { name: string; specialty: string }[]> = {
	"Manipal Hospital, Old Airport Rd": [
		{ name: "Dr. Anita Rao", specialty: "Trauma Surgery" },
		{ name: "Dr. Rakesh Sinha", specialty: "Neurosurgery" },
		{ name: "Dr. Pooja Shetty", specialty: "Cardiology" },
	],
	"Fortis Hospital, Bannerghatta Rd": [
		{ name: "Dr. Suresh Iyer", specialty: "Cardiology" },
		{ name: "Dr. Nandini K", specialty: "Burns & Plastic Surgery" },
	],
	"St. John's Medical College Hospital": [
		{ name: "Dr. Meera Joseph", specialty: "Orthopedics" },
		{ name: "Dr. Thomas Abraham", specialty: "General Surgery" },
	],
	"Victoria Hospital (Govt.)": [
		{ name: "Dr. Ramesh Gowda", specialty: "Emergency Medicine" },
		{ name: "Dr. Lakshmi Devi", specialty: "Toxicology" },
	],
	"Sakra World Hospital": [
		{ name: "Dr. Kavya Nair", specialty: "Neurology" },
		{ name: "Dr. Arvind Menon", specialty: "Cardiology" },
	],
	"Basaveshwar Teaching & General Hospital": [
		{ name: "Dr. Shivakumar Patil", specialty: "Emergency Medicine" },
		{ name: "Dr. Mahesh Hiremath", specialty: "Orthopedics" },
	],
	"KBN Teaching & General Hospital": [
		{ name: "Dr. Farah Siddiqui", specialty: "Cardiology" },
		{ name: "Dr. Imtiaz Ali", specialty: "Neurology" },
	],
	"ESIC Medical College & Hospital": [
		{ name: "Dr. Ravi Kulkarni", specialty: "Trauma Surgery" },
		{ name: "Dr. Sunita Rao", specialty: "Burns & Plastic Surgery" },
	],
	"District Government Hospital": [
		{ name: "Dr. Anjali Deshmukh", specialty: "Emergency Medicine" },
		{ name: "Dr. Vijay Naik", specialty: "Toxicology" },
	],
};

export type AmbulanceSeed = {
	vehicleNumber: string;
	driverName: string;
	helperName: string;
	city: City;
	lat: number;
	lng: number;
	equipmentLevel: "basic" | "advanced";
};

export const AMBULANCES: AmbulanceSeed[] = [
	{
		vehicleNumber: "KA-01-AB-1234",
		driverName: "Manjunath K",
		helperName: "Ravi Kumar",
		city: "bengaluru",
		lat: 12.9716,
		lng: 77.5946,
		equipmentLevel: "advanced",
	},
	{
		vehicleNumber: "KA-01-AB-5678",
		driverName: "Suresh P",
		helperName: "Anil D",
		city: "bengaluru",
		lat: 12.9352,
		lng: 77.6245,
		equipmentLevel: "basic",
	},
	{
		vehicleNumber: "KA-01-AB-9012",
		driverName: "Lokesh R",
		helperName: "Farhan A",
		city: "bengaluru",
		lat: 12.9098,
		lng: 77.6412,
		equipmentLevel: "advanced",
	},
	{
		vehicleNumber: "KA-01-AB-3456",
		driverName: "Naveen S",
		helperName: "Vinay M",
		city: "bengaluru",
		lat: 12.9784,
		lng: 77.6408,
		equipmentLevel: "basic",
	},
	{
		vehicleNumber: "KA-01-AB-7890",
		driverName: "Prakash T",
		helperName: "Joseph K",
		city: "bengaluru",
		lat: 12.9141,
		lng: 77.5811,
		equipmentLevel: "advanced",
	},
	{
		vehicleNumber: "KA-01-AB-2468",
		driverName: "Imran H",
		helperName: "Deepak N",
		city: "bengaluru",
		lat: 12.9611,
		lng: 77.6042,
		equipmentLevel: "basic",
	},
	{
		vehicleNumber: "KA-01-AB-1357",
		driverName: "Mahesh B",
		helperName: "Sandeep R",
		city: "bengaluru",
		lat: 12.9483,
		lng: 77.67,
		equipmentLevel: "advanced",
	},
	{
		vehicleNumber: "KA-01-AB-8642",
		driverName: "Ganesh V",
		helperName: "Kiran S",
		city: "bengaluru",
		lat: 12.8997,
		lng: 77.6098,
		equipmentLevel: "basic",
	},
	{
		vehicleNumber: "KA-01-AB-9753",
		driverName: "Ravindra P",
		helperName: "Yusuf M",
		city: "bengaluru",
		lat: 12.9856,
		lng: 77.5602,
		equipmentLevel: "advanced",
	},
	{
		vehicleNumber: "KA-01-AB-1597",
		driverName: "Chetan K",
		helperName: "Arjun L",
		city: "bengaluru",
		lat: 12.9203,
		lng: 77.6529,
		equipmentLevel: "basic",
	},
	// Kalaburagi
	{
		vehicleNumber: "KA-32-AB-1101",
		driverName: "Basavaraj M",
		helperName: "Santosh H",
		city: "kalaburagi",
		lat: 17.329,
		lng: 76.826,
		equipmentLevel: "advanced",
	},
	{
		vehicleNumber: "KA-32-AB-1102",
		driverName: "Shankar R",
		helperName: "Mallikarjun D",
		city: "kalaburagi",
		lat: 17.341,
		lng: 76.842,
		equipmentLevel: "basic",
	},
	{
		vehicleNumber: "KA-32-AB-1103",
		driverName: "Abdul K",
		helperName: "Irfan S",
		city: "kalaburagi",
		lat: 17.318,
		lng: 76.838,
		equipmentLevel: "advanced",
	},
	{
		vehicleNumber: "KA-32-AB-1104",
		driverName: "Raju N",
		helperName: "Mahantesh P",
		city: "kalaburagi",
		lat: 17.35,
		lng: 76.823,
		equipmentLevel: "basic",
	},
];

// Seeded Bengaluru junctions. Other cities (and every planned route) get their
// junctions automatically from OpenStreetMap when a route is planned.
export const SIGNALS: { name: string; city: City; lat: number; lng: number }[] =
	[
		{
			name: "Hosur Rd x Bannerghatta Rd",
			city: "bengaluru",
			lat: 12.9279,
			lng: 77.6105,
		},
		{
			name: "Silk Board Junction",
			city: "bengaluru",
			lat: 12.9176,
			lng: 77.6233,
		},
		{
			name: "Koramangala 80ft Rd x Sarjapur Rd",
			city: "bengaluru",
			lat: 12.9352,
			lng: 77.6146,
		},
		{
			name: "Trinity Circle, MG Road",
			city: "bengaluru",
			lat: 12.9719,
			lng: 77.6196,
		},
		{
			name: "Old Airport Rd x Domlur",
			city: "bengaluru",
			lat: 12.9609,
			lng: 77.6387,
		},
		{ name: "Richmond Circle", city: "bengaluru", lat: 12.9656, lng: 77.5996 },
		{
			name: "Lalbagh West Gate",
			city: "bengaluru",
			lat: 12.9486,
			lng: 77.5847,
		},
	];

// SYNTHETIC patients. ABHA numbers below are fake.
export const PATIENTS = [
	{
		fullName: "Ravi Shankar",
		phone: "9845011223",
		abhaNumber: "91-1111-2222-3333",
		age: 29,
		bloodGroup: "O+",
		knownAllergies: ["Penicillin"],
		chronicConditions: [] as string[],
		records: [
			{
				daysAgo: 200,
				diagnosis: "Fractured left wrist (two-wheeler fall)",
				notes: "Cast applied, fully healed.",
			},
			{
				daysAgo: 40,
				diagnosis: "Viral fever",
				notes: "Paracetamol, rest. Recovered.",
			},
		],
	},
	{
		fullName: "Priya Menon",
		phone: "9886123456",
		abhaNumber: "91-4444-5555-6666",
		age: 34,
		bloodGroup: "A-",
		knownAllergies: [] as string[],
		chronicConditions: ["Asthma"],
		records: [
			{
				daysAgo: 120,
				diagnosis: "Asthma exacerbation",
				notes: "Nebulization given. Inhaler plan reviewed.",
			},
		],
	},
	{
		fullName: "Arjun Reddy",
		phone: "9900112233",
		abhaNumber: "91-7777-8888-9999",
		age: 41,
		bloodGroup: "B+",
		knownAllergies: ["Sulfa drugs"],
		chronicConditions: ["Type 2 Diabetes", "Hypertension"],
		records: [
			{
				daysAgo: 300,
				diagnosis: "Hypertension follow-up",
				notes: "Amlodipine dose adjusted.",
			},
			{
				daysAgo: 90,
				diagnosis: "Chest discomfort, ECG normal",
				notes: "Advised stress test. Not yet done.",
			},
		],
	},
	{
		fullName: "Basavaraj Hiremath",
		phone: "9448012345",
		abhaNumber: "91-1212-3434-5656",
		age: 63,
		bloodGroup: "B-",
		knownAllergies: [] as string[],
		chronicConditions: ["Coronary artery disease", "Hypertension"],
		records: [
			{
				daysAgo: 150,
				diagnosis: "Angina, started on beta-blocker",
				notes: "Cardiology review in 6 months.",
			},
		],
	},
];

export type ScenarioKey = "cardiac_en" | "cardiac_kn" | "accident_hi";

export type ScenarioDef = {
	label: string;
	city: City;
	language: string;
	lat: number;
	lng: number;
	address: string;
	callerPhone: string;
	chunks: { original: string; english: string }[];
};

export const SCENARIOS: Record<ScenarioKey, ScenarioDef> = {
	cardiac_en: {
		label: "Cardiac emergency, English, Bengaluru",
		city: "bengaluru",
		language: "en",
		lat: 12.9779,
		lng: 77.5952,
		address: "Near MG Road, Bengaluru",
		callerPhone: "9845011223",
		chunks: [
			{
				original: "Hello, please send an ambulance, it is an emergency.",
				english: "Hello, please send an ambulance, it is an emergency.",
			},
			{
				original:
					"My father is having severe chest pain and he is sweating a lot.",
				english:
					"My father is having severe chest pain and he is sweating a lot.",
			},
			{
				original:
					"He is sitting on the floor, he can barely speak and he is having trouble breathing.",
				english:
					"He is sitting on the floor, he can barely speak and he is having trouble breathing.",
			},
			{
				original: "We are near MG Road metro station, Bengaluru.",
				english: "We are near MG Road metro station, Bengaluru.",
			},
		],
	},
	cardiac_kn: {
		label: "Cardiac emergency, Kannada, Kalaburagi",
		city: "kalaburagi",
		language: "kn",
		lat: 17.335,
		lng: 76.833,
		address: "Near Super Market, Kalaburagi",
		callerPhone: "9448012345",
		chunks: [
			{
				original: "ಹಲೋ, ದಯವಿಟ್ಟು ಆಂಬ್ಯುಲೆನ್ಸ್ ಕಳುಹಿಸಿ, ತುರ್ತು ಪರಿಸ್ಥಿತಿ ಇದೆ.",
				english: "Hello, please send an ambulance, it is an emergency.",
			},
			{
				original: "ನನ್ನ ತಂದೆಗೆ ತುಂಬಾ ಎದೆ ನೋವು ಬಂದಿದೆ, ಬೆವರುತ್ತಿದ್ದಾರೆ.",
				english: "My father has severe chest pain and is sweating.",
			},
			{
				original: "ಅವರಿಗೆ ಉಸಿರಾಡಲು ಕಷ್ಟವಾಗುತ್ತಿದೆ, ಮಾತನಾಡಲು ಆಗುತ್ತಿಲ್ಲ.",
				english: "He is having difficulty breathing and cannot speak.",
			},
			{
				original: "ನಾವು ಕಲಬುರಗಿಯ ಸೂಪರ್ ಮಾರ್ಕೆಟ್ ಹತ್ತಿರ ಇದ್ದೇವೆ.",
				english: "We are near Super Market, Kalaburagi.",
			},
		],
	},
	accident_hi: {
		label: "Road accident, Hindi, Bengaluru",
		city: "bengaluru",
		language: "hi",
		lat: 12.9352,
		lng: 77.6245,
		address: "Koramangala signal, Bengaluru",
		callerPhone: "9886123456",
		chunks: [
			{
				original: "जल्दी एम्बुलेंस भेजिए, सड़क पर एक्सीडेंट हो गया है।",
				english:
					"Please send an ambulance quickly, there has been a road accident.",
			},
			{
				original: "एक आदमी का पैर टूट गया है और उसके सिर से बहुत खून बह रहा है।",
				english:
					"A man's leg is broken and he is bleeding heavily from his head.",
			},
			{
				original: "वो बेहोश है, कोरमंगला के सिग्नल के पास।",
				english: "He is unconscious, near the signal in Koramangala.",
			},
		],
	},
};

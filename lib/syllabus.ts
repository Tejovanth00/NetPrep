export type Paper = "PAPER_1" | "PAPER_2";

export type SyllabusUnit = {
  unitNumber: number;
  unitName: string;
  paper: Paper;
};

export const SYLLABUS_UNITS: SyllabusUnit[] = [
  { unitNumber: 101, unitName: "Teaching Aptitude", paper: "PAPER_1" },
  { unitNumber: 102, unitName: "Research Aptitude", paper: "PAPER_1" },
  { unitNumber: 103, unitName: "Comprehension", paper: "PAPER_1" },
  { unitNumber: 104, unitName: "Communication", paper: "PAPER_1" },
  { unitNumber: 105, unitName: "Mathematical Reasoning and Aptitude", paper: "PAPER_1" },
  { unitNumber: 106, unitName: "Logical Reasoning", paper: "PAPER_1" },
  { unitNumber: 107, unitName: "Data Interpretation", paper: "PAPER_1" },
  { unitNumber: 108, unitName: "Information and Communication Technology (ICT)", paper: "PAPER_1" },
  { unitNumber: 109, unitName: "People, Development and Environment", paper: "PAPER_1" },
  { unitNumber: 110, unitName: "Higher Education System", paper: "PAPER_1" },
  { unitNumber: 1, unitName: "Discrete Structures and Optimization", paper: "PAPER_2" },
  { unitNumber: 2, unitName: "Computer System Architecture", paper: "PAPER_2" },
  { unitNumber: 3, unitName: "Programming Languages and Computer Graphics", paper: "PAPER_2" },
  { unitNumber: 4, unitName: "Database Management Systems", paper: "PAPER_2" },
  { unitNumber: 5, unitName: "System Software and Operating System", paper: "PAPER_2" },
  { unitNumber: 6, unitName: "Software Engineering", paper: "PAPER_2" },
  { unitNumber: 7, unitName: "Data Structures and Algorithms", paper: "PAPER_2" },
  { unitNumber: 8, unitName: "Theory of Computation and Compilers", paper: "PAPER_2" },
  { unitNumber: 9, unitName: "Data Communication and Computer Networks", paper: "PAPER_2" },
  { unitNumber: 10, unitName: "Artificial Intelligence (AI)", paper: "PAPER_2" },
];

export function getSyllabusUnit(unitNumber: number): SyllabusUnit {
  return SYLLABUS_UNITS.find((unit) => unit.unitNumber === unitNumber) ?? {
    unitNumber,
    unitName: unitNumber >= 101 ? "Paper 1 Aptitude" : "Computer Science",
    paper: unitNumber >= 101 ? "PAPER_1" : "PAPER_2",
  };
}

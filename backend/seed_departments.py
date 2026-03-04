from sqlalchemy.orm import Session
import re

import models


def _norm(text: str) -> str:
    base = (text or "").strip().lower()
    base = re.sub(r"[^a-z0-9 ]", " ", base)
    return re.sub(r"\s+", " ", base).strip()


SEED_DEPARTMENTS = [
    {
        "name": "District Mineral Foundation (DMF)",
        "short_name": "DMF",
        "description": "District Mineral Foundation planning and service-delivery oversight.",
        "color": "amber",
        "icon": "Building2",
        "match_names": [
            "District Mineral Foundation (DMF)",
            "District Mineral Foundation",
            "DMF",
        ],
        "agenda": [
            {
                "title": "Annual Action Plan (AAP)",
                "details": "Mapping current projects against the \"High Priority\" (60%) and \"Other Priority\" (40%) statutory mandate.",
            },
            {
                "title": "Physical vs. Financial Progress",
                "details": "Identifying \"Ghost Projects\" where funds are drawn but work has not started.",
            },
            {
                "title": "Social Audit",
                "details": "Conducting third-party evaluations of completed school buildings and health centers.",
            },
            {
                "title": "Health Infrastructure",
                "details": "Procurement of specialized equipment (MRI, CT Scan) and ensuring AMC (Annual Maintenance Contracts).",
            },
            {
                "title": "Staffing Continuity",
                "details": "Timely payment of salaries for \"DMF-Contractual\" doctors and teachers to prevent attrition.",
            },
            {
                "title": "Nutritional Support",
                "details": "Funding for \"Egg/Milk\" distribution in Anganwadis beyond state-sanctioned budgets.",
            },
            {
                "title": "Sustainability",
                "details": "Ensuring line departments (PWD/WCD) have a handover plan for assets created by DMF.",
            },
            {
                "title": "Audit Compliance",
                "details": "Addressing AG (Accountant General) audit queries to avoid future recovery issues.",
            },
            {
                "title": "Project Diversification",
                "details": "Shifting focus from \"Civil Works\" to \"Service Delivery\" (for example, mobile medical units).",
            },
            {
                "title": "Transparency",
                "details": "Updating the PMKKKY portal with real-time project photos and GPS coordinates.",
            },
        ],
    },
    {
        "name": "Education (Primary & Secondary)",
        "short_name": "EDU",
        "description": "Primary and secondary school governance, outcomes, and infrastructure.",
        "color": "indigo",
        "icon": "Building2",
        "match_names": [
            "Education (Primary & Secondary)",
            "Education Department",
            "Education",
        ],
        "agenda": [
            {
                "title": "Atmanand School Excellence",
                "details": "Weekly review of English medium curriculum delivery and teacher attendance.",
            },
            {
                "title": "Learning Recovery",
                "details": "Monitoring \"Nikhar\" or similar bridge courses for students lagging in basic numeracy.",
            },
            {
                "title": "Infrastructure (PM-SHRI)",
                "details": "Upgrading selected schools to national standards with labs and smart classes.",
            },
            {
                "title": "Board Exam Prep",
                "details": "Organizing special coaching and residential camps for 10th and 12th graders in interior blocks.",
            },
            {
                "title": "Dropout Mapping",
                "details": "Identifying \"Never Enrolled\" or long-absent children, especially in sensitive zones.",
            },
            {
                "title": "Jatan Yojana",
                "details": "Monitoring the large-scale renovation of old school buildings.",
            },
            {
                "title": "Library Culture",
                "details": "Ensuring functional libraries in every High School with local language books.",
            },
            {
                "title": "Teacher Rationalization",
                "details": "Moving teachers from surplus urban schools to deficit rural schools.",
            },
            {
                "title": "MDM Hygiene",
                "details": "Surprise inspections of Mid-Day Meal quality and kitchen-shed cleanliness.",
            },
            {
                "title": "Vocational Integration",
                "details": "Linking 9th-12th grade students with the Livelihood College for \"Saturday Skills.\"",
            },
        ],
    },
    {
        "name": "Health & Wellness",
        "short_name": "HEA",
        "description": "Public health systems, maternal-child outcomes, and disease control.",
        "color": "emerald",
        "icon": "Building2",
        "match_names": [
            "Health & Wellness",
            "Health",
            "Health Department",
        ],
        "agenda": [
            {
                "title": "Haat-Bazaar Clinic",
                "details": "Ensuring the medical mobile van reaches every weekly market with a full kit of 80+ medicines.",
            },
            {
                "title": "Maternal Mortality (MMR)",
                "details": "Tracking high-risk pregnancies (HRP) via the ANM-CHO network.",
            },
            {
                "title": "Sickle Cell Screening",
                "details": "District-wide screening and distribution of color-coded cards for genetic counseling.",
            },
            {
                "title": "Malnutrition (Suposhan)",
                "details": "Monitoring the transition of children from Red (SAM) to Green (Normal) zones.",
            },
            {
                "title": "Institutional Delivery",
                "details": "Ensuring 100% of births happen in hospitals to reduce infant mortality.",
            },
            {
                "title": "Malaria Mukt Bastar",
                "details": "Timely distribution of LLIN nets and \"Mass Screening\" before the monsoon.",
            },
            {
                "title": "TB Mukt Abhiyan",
                "details": "Door-to-door screening and ensuring \"Nikshay Poshan\" payments to patients.",
            },
            {
                "title": "Blood Bank Operations",
                "details": "Ensuring the availability of all blood groups and functional storage in Dantewada.",
            },
            {
                "title": "Staff Training",
                "details": "Skill-lab training for Nurses and CHO on emergency obstetric care.",
            },
            {
                "title": "Cleanliness (Kayakalp)",
                "details": "Grading CHCs and PHCs on hygiene and patient-friendliness.",
            },
        ],
    },
    {
        "name": "Navgurukul (Software Engineering)",
        "short_name": "NAV",
        "description": "Residential software training, employability, and placement outcomes.",
        "color": "violet",
        "icon": "Building2",
        "match_names": [
            "Navgurukul (Software Engineering)",
            "Navgurukul",
        ],
        "agenda": [
            {
                "title": "Curriculum Mastery",
                "details": "Reviewing \"Check-ins\" of students on coding platforms (JavaScript, Python).",
            },
            {
                "title": "English & Soft Skills",
                "details": "Monitoring the daily \"Culture\" sessions to improve employability.",
            },
            {
                "title": "Campus Hygiene",
                "details": "Ensuring the residential facility meets standards for water, food, and safety.",
            },
            {
                "title": "Peer-to-Peer Learning",
                "details": "Evaluating the \"Council\" system where students manage campus operations.",
            },
            {
                "title": "Placement Readiness",
                "details": "Mock interviews and resume-building workshops for the senior-most batch.",
            },
            {
                "title": "Outreach",
                "details": "Sending Navgurukul ambassadors to interior schools to inspire tribal students to apply.",
            },
            {
                "title": "Internet Uptime",
                "details": "Ensuring 100% fiber connectivity, critical for a coding campus.",
            },
            {
                "title": "Hardware Audit",
                "details": "Checking the health of laptops and replacement of faulty units.",
            },
            {
                "title": "Alumni Connect",
                "details": "Creating a database of placed students to act as mentors.",
            },
        ],
    },
    {
        "name": "Skill Development & Livelihood College",
        "short_name": "SKL",
        "description": "Skilling, placement, and livelihood pathway governance.",
        "color": "teal",
        "icon": "Building2",
        "match_names": [
            "Skill Development & Livelihood College",
            "Livelihood College",
            "Skill Development",
        ],
        "agenda": [
            {
                "title": "Nodal Oversight",
                "details": "Validating the quality of VTPs (Vocational Training Providers) operating in the district.",
            },
            {
                "title": "Job Melas",
                "details": "Organizing monthly placement drives with private sector partners (Retail, Security, BPO).",
            },
            {
                "title": "Customized Courses",
                "details": "Starting trades relevant to Dantewada (Heavy Vehicle Driving, Solar Pump Repair).",
            },
            {
                "title": "Hostel Management",
                "details": "Ensuring a safe, drug-free environment for residential trainees.",
            },
            {
                "title": "Self-Employment Linkage",
                "details": "Helping certified students get loans under PMEGP or Mukhya Mantri Yuva Swarozgar.",
            },
            {
                "title": "Industry Tie-ups",
                "details": "Signing MoUs with companies for \"Captive Placement\" (guaranteed jobs).",
            },
            {
                "title": "Surrendered Cadre",
                "details": "Special batches for rehabilitated individuals with sensitive counseling.",
            },
            {
                "title": "Post-Placement Tracking",
                "details": "Calling students 3-6 months after they join a job to check retention.",
            },
            {
                "title": "Skill Mapping",
                "details": "Surveying what skills the local mining or hospitality industry actually needs.",
            },
        ],
    },
    {
        "name": "Maatikala & RIPA (Rural Industrial Parks)",
        "short_name": "RIPA",
        "description": "Rural industrial parks, SHG enterprises, and value-addition chains.",
        "color": "orange",
        "icon": "Building2",
        "match_names": [
            "Maatikala & RIPA (Rural Industrial Parks)",
            "Maatikala & RIPA",
            "RIPA",
        ],
        "agenda": [
            {
                "title": "Entrepreneur Selection",
                "details": "Identifying \"Livelihood Entrepreneurs\" to run units in Gauthans.",
            },
            {
                "title": "Maatikala Modernization",
                "details": "Distribution of power-wheels to terracotta artists in villages like Gamawada.",
            },
            {
                "title": "Branding & Packaging",
                "details": "Professionalizing the \"Dantewada Brand\" for forest honey, millets, and pottery.",
            },
            {
                "title": "C-Mart Integration",
                "details": "Ensuring every RIPA product is stocked and sold through the district C-Mart.",
            },
            {
                "title": "Working Capital",
                "details": "Facilitating bank CC (credit cash) limits for SHGs running RIPA units.",
            },
            {
                "title": "Electricity/Water",
                "details": "Solving last-mile utility issues for industrial machinery in rural parks.",
            },
            {
                "title": "Millet Cafe",
                "details": "Monitoring the operation and profitability of the millet cafes.",
            },
            {
                "title": "Tamarind/Mahua Value Addition",
                "details": "Moving from selling raw produce to selling pulp and processed goods.",
            },
            {
                "title": "Exposure Visits",
                "details": "Taking SHG women to successful food processing hubs in other states.",
            },
        ],
    },
    {
        "name": "Kendriya Vidyalaya (Nodal)",
        "short_name": "KV",
        "description": "Nodal oversight for Kendriya Vidyalaya institutional readiness.",
        "color": "sky",
        "icon": "Building2",
        "match_names": [
            "Kendriya Vidyalaya (Nodal)",
            "Kendriya Vidyalaya",
            "KV",
        ],
        "agenda": [
            {
                "title": "VMC Meetings",
                "details": "Conducting quarterly Vidyalaya Management Committee meetings as the Collector's representative.",
            },
            {
                "title": "Land & Building",
                "details": "Expediting the transfer of land or permanent building construction for the KV.",
            },
            {
                "title": "Safety Audit",
                "details": "Ensuring fire safety, electrical safety, and structural stability of the campus.",
            },
            {
                "title": "Civil Works",
                "details": "Overseeing small repairs funded by the Zila Panchayat or DMF.",
            },
            {
                "title": "Admissions",
                "details": "Managing the \"Nodal Officer\" quota and ensuring transparent admission processes.",
            },
        ],
    },
    {
        "name": "Science Centre & Tribal Museum",
        "short_name": "SCI",
        "description": "Science center operations and tribal museum curation governance.",
        "color": "rose",
        "icon": "Building2",
        "match_names": [
            "Science Centre & Tribal Museum",
            "Science Centre",
            "Tribal Museum",
        ],
        "agenda": [
            {
                "title": "Science Centre Maintenance",
                "details": "Daily upkeep of interactive exhibits and the 3D theater and planetarium.",
            },
            {
                "title": "School Visit Calendar",
                "details": "Scheduling mandatory weekly visits for all government schools.",
            },
            {
                "title": "Museum Curation",
                "details": "Engaging with tribal elders to ensure authentic representation of Gondi, Dhurwa, and Maria culture.",
            },
            {
                "title": "Digital Integration",
                "details": "Adding QR codes to museum artifacts for multi-lingual audio guides.",
            },
            {
                "title": "Souvenir Shop",
                "details": "Setting up a retail point for local tribal art within the museum premises.",
            },
        ],
    },
    {
        "name": "Collector's Time Limit (TL) Agenda",
        "short_name": "TL",
        "description": "Collector-level interdepartmental and time-limit issue review.",
        "color": "indigo",
        "icon": "Building2",
        "match_names": [
            "Collector's Time Limit (TL) Agenda",
            "Collector Time Limit Agenda",
            "TL Agenda",
        ],
        "agenda": [
            {
                "title": "Inter-Departmental Convergence",
                "details": "Solving issues where health needs PWD land or education needs PHE water.",
            },
            {
                "title": "Public Grievance",
                "details": "Weekly disposal of \"Janman\" and \"Jan-Chaupal\" complaints.",
            },
            {
                "title": "CM Dashboard",
                "details": "Monitoring the district's ranking on the state-wide CM Dashboard.",
            },
            {
                "title": "Court Cases",
                "details": "Ensuring timely filing of OIC (Officer in Charge) replies in High Court and Tribunal matters.",
            },
            {
                "title": "Legislative Assembly (Vidhan Sabha) Questions",
                "details": "Providing accurate, lightning-fast data for star and unstarred questions.",
            },
            {
                "title": "VVIP Visits",
                "details": "Protocol and presentation preparation for ministerial or governor visits.",
            },
        ],
    },
]


def _find_department(existing_departments: list[models.Department], aliases: list[str]) -> models.Department | None:
    alias_keys = {_norm(x) for x in aliases if x}
    for dept in existing_departments:
        if _norm(dept.name) in alias_keys:
            return dept
    return None


def seed_departments_and_agenda(db: Session):
    existing_departments = db.query(models.Department).all()
    created_departments = 0
    touched_departments = 0
    added_agenda = 0
    updated_agenda = 0

    for seed_dept in SEED_DEPARTMENTS:
        aliases = seed_dept.get("match_names") or [seed_dept["name"]]
        dept = _find_department(existing_departments, aliases)
        is_new_department = False

        if not dept:
            dept = models.Department(
                name=seed_dept["name"],
                short_name=seed_dept.get("short_name"),
                description=seed_dept.get("description"),
                category_name="General",
                category_order=0,
                display_order=len(existing_departments),
                priority_level="Normal",
                color=seed_dept.get("color", "indigo"),
                icon=seed_dept.get("icon", "Building2"),
                is_active=True,
            )
            db.add(dept)
            db.flush()
            existing_departments.append(dept)
            created_departments += 1
            is_new_department = True
        else:
            changed = False
            if not (dept.short_name or "").strip() and seed_dept.get("short_name"):
                dept.short_name = seed_dept["short_name"]
                changed = True
            if not (dept.description or "").strip() and seed_dept.get("description"):
                dept.description = seed_dept["description"]
                changed = True
            if not (dept.color or "").strip() and seed_dept.get("color"):
                dept.color = seed_dept["color"]
                changed = True
            if not (dept.icon or "").strip() and seed_dept.get("icon"):
                dept.icon = seed_dept["icon"]
                changed = True
            if not (dept.category_name or "").strip():
                dept.category_name = "General"
                changed = True
            if dept.category_order is None:
                dept.category_order = 0
                changed = True
            if dept.display_order is None:
                dept.display_order = 0
                changed = True
            if not (dept.priority_level or "").strip():
                dept.priority_level = "Normal"
                changed = True
            if dept.is_active is False:
                dept.is_active = True
                changed = True
            if changed:
                touched_departments += 1

        # Do not mutate agenda for existing departments on startup.
        # Existing data is user-managed and must remain stable across deploys.
        if not is_new_department:
            continue

        existing_agenda = db.query(models.AgendaPoint).filter(
            models.AgendaPoint.department_id == dept.id
        ).all()
        agenda_by_norm_title = {_norm(item.title): item for item in existing_agenda}
        max_order = max([(item.order_index or 0) for item in existing_agenda], default=0)

        for idx, seed_agenda in enumerate(seed_dept["agenda"], start=1):
            title = (seed_agenda.get("title") or "").strip()
            details = (seed_agenda.get("details") or "").strip() or None
            if not title:
                continue

            key = _norm(title)
            existing_item = agenda_by_norm_title.get(key)
            if existing_item:
                changed = False
                if not (existing_item.details or "").strip() and details:
                    existing_item.details = details
                    changed = True
                if existing_item.order_index is None:
                    existing_item.order_index = idx
                    changed = True
                if not (existing_item.status or "").strip():
                    existing_item.status = "Open"
                    changed = True
                if changed:
                    updated_agenda += 1
                continue

            max_order += 1
            db.add(
                models.AgendaPoint(
                    department_id=dept.id,
                    title=title,
                    details=details,
                    status="Open",
                    order_index=max_order,
                )
            )
            added_agenda += 1

    db.commit()
    print(
        "✅ Department seed complete: "
        f"created_departments={created_departments}, "
        f"updated_departments={touched_departments}, "
        f"added_agenda={added_agenda}, "
        f"updated_agenda={updated_agenda}"
    )

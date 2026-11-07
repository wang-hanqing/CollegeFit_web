import java.nio.file.*;
import java.util.*;

/** Dumps Explore results for a few profiles, to check the web version against. */
public class ExploreDump {
    public static void main(String[] a) throws Exception {
        Path data = Paths.get("/home/claude/JAVA_CollegeFit/data/processed");
        List<College> colleges = CollegeDataLoader.load(data.resolve("colleges.csv"), data.resolve("programs.csv"));
        List<Program> programs = CollegeDataLoader.loadProgramList(data.resolve("programs.csv"), colleges);
        Map<String, Program> byCode = new HashMap<>();
        for (Program p : programs) byCode.put(p.cipCode, p);
        RecommendationEngine engine = new RecommendationEngine();
        // name | fields | home | scope(state/anywhere/A+B) | pathway | priorities | settings | sizes
        String[][] cases = {
            {"video", "51,52", "NY", "state", "NOT_SURE", "COSTS,ADMISSION"},
            {"cs-us", "11", "NY", "anywhere", "BACHELOR", "GRADUATION,COSTS,STUDY"},
            {"none-ny", "", "NY", "state", "ASSOCIATE", ""},
            {"ca-mix", "24,26,42", "CA", "state", "NOT_SURE", "STUDY,CAMPUS"},
            {"tx-health", "51", "TX", "state", "NOT_SURE", "ADMISSION,GRADUATION,COSTS"},
            {"biz-us-nohome", "52", "", "anywhere", "NOT_SURE", "CAMPUS"},
            {"arts-ny-assoc", "50", "NY", "state", "ASSOCIATE", "COSTS"},
            {"subject-mix", "5138,12,1205", "NY", "NY+NJ", "BOTH", "CAMPUS,STUDY", "URBAN", "LARGE"},
            {"place-rural", "", "CA", "state", "NOT_SURE", "CAMPUS,COSTS", "RURAL,TOWN", "SMALL"},
            {"us-campus", "52,1101", "TX", "anywhere", "BACHELOR", "STUDY,CAMPUS,GRADUATION", "SUBURBAN", "MEDIUM,LARGE"},
        };
        StringBuilder out = new StringBuilder("{");
        boolean first = true;
        for (String[] k : cases) {
            StudentProfile s = new StudentProfile();
            List<Program> ps = new ArrayList<>();
            for (String f : k[1].split(",")) if (!f.isEmpty()) ps.add(f.length() == 2 ? Program.family(f, 0) : byCode.get(f));
            s.setPrograms(ps);
            if (!k[2].isEmpty()) s.setHomeState(k[2]);
            if (k[3].contains("+")) s.setPreferredStates(new HashSet<>(Arrays.asList(k[3].split("\\+"))));
            else if (k[3].equals("state") && !k[2].isEmpty()) s.setPreferredStates(Set.of(k[2]));
            else s.setLocationScope(StudentProfile.LocationScope.ANY_STATE);
            s.setPathway(StudentProfile.Pathway.valueOf(k[4]));
            List<StudentProfile.Priority> pr = new ArrayList<>();
            for (String p : k[5].split(",")) if (!p.isEmpty()) pr.add(StudentProfile.Priority.valueOf(p));
            s.setPriorities(pr);
            List<StudentProfile.CampusSetting> st = new ArrayList<>();
            if (k.length > 6) for (String x : k[6].split(",")) if (!x.isEmpty()) st.add(StudentProfile.CampusSetting.valueOf(x));
            s.setSettings(st);
            List<StudentProfile.CollegeSize> sz = new ArrayList<>();
            if (k.length > 7) for (String x : k[7].split(",")) if (!x.isEmpty()) sz.add(StudentProfile.CollegeSize.valueOf(x));
            s.setSizes(sz);
            List<CollegeRecommendation> ranked = engine.recommend(s, colleges);
            Map<College.Type, List<CollegeRecommendation>> groups = RecommendationEngine.groups(ranked, s.getPathway());
            if (!first) out.append(","); first = false;
            out.append("\"").append(k[0]).append("\":{\"total\":").append(ranked.size());
            for (College.Type t : College.Type.values()) {
                out.append(",\"").append(t.name()).append("\":[");
                List<CollegeRecommendation> g = groups.get(t);
                for (int i = 0; i < g.size(); i++) {
                    CollegeRecommendation r = g.get(i);
                    if (i > 0) out.append(",");
                    if (i < 6) {
                        Integer cost = RecommendationEngine.comparableCost(s, r.college);
                        out.append("[\"").append(r.college.unitId).append("\",").append(r.programsAwarded).append(",").append(r.recentDegrees)
                           .append(",").append(r.associateAwarded).append(",").append(r.bachelorAwarded).append(",").append(cost)
                           .append(",").append(r.social.matched).append("]");
                    } else out.append("\"").append(r.college.unitId).append("\"");
                }
                out.append("]");
            }
            out.append("}");
        }
        out.append("}");
        System.out.println(out);
    }
}

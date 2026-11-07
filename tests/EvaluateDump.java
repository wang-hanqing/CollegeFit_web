import java.nio.file.*;
import java.util.*;

/** Dumps every lens result for a set of colleges and profiles, to check the web version against. */
public class EvaluateDump {
    static String q(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char ch : s.toCharArray()) {
            if (ch == '"' || ch == '\\') b.append('\\').append(ch);
            else if (ch == '\n') b.append("\\n");
            else if (ch < 0x20) b.append(String.format("\\u%04x", (int) ch));
            else b.append(ch);
        }
        return b.append('"').toString();
    }
    static String res(EvaluationResult r) {
        StringBuilder b = new StringBuilder("{\"status\":").append(q(r.status.name())).append(",\"label\":").append(q(r.label))
            .append(",\"reason\":").append(q(r.reason)).append(",\"nextStep\":").append(q(r.nextStep)).append(",\"facts\":[");
        for (int i = 0; i < r.facts.size(); i++) {
            Fact f = r.facts.get(i);
            if (i > 0) b.append(",");
            b.append("[").append(q(f.label)).append(",").append(q(f.value)).append(",").append(q(f.note)).append(",").append(f.match).append("]");
        }
        return b.append("]}").toString();
    }
    public static void main(String[] a) throws Exception {
        Path data = Paths.get("/home/claude/JAVA_CollegeFit/data/processed");
        List<College> colleges = CollegeDataLoader.load(data.resolve("colleges.csv"), data.resolve("programs.csv"));
        List<Program> programs = CollegeDataLoader.loadProgramList(data.resolve("programs.csv"), colleges);
        Map<String, Program> byCode = new HashMap<>();
        for (Program p : programs) byCode.put(p.cipCode, p);
        RecommendationEngine engine = new RecommendationEngine();

        List<College> pick = new ArrayList<>();
        Set<String> wanted = new HashSet<>(Arrays.asList("190521","190530","166027","190150","193900","196079","110635","204796","130794","186131","190664","190567"));
        for (College c : colleges) if (wanted.contains(c.unitId)) pick.add(c);
        for (int i = 0; i < colleges.size(); i += 47) pick.add(colleges.get(i));

        String[][] profiles = {
            // name, programs, home, scope, pathway, sat "r/m" or "", budget or "", aid, income, settings, sizes
            {"A", "51,52", "NY", "state", "NOT_SURE", "", "", "NOT_SURE", "NOT_SURE", "", ""},
            {"B", "5138,11,1205", "NY", "anywhere", "BACHELOR", "600/550", "20000", "YES", "FROM_30K_TO_48K", "URBAN,TOWN", "LARGE"},
            {"C", "", "CA", "state", "ASSOCIATE", "450/700", "5000", "NO", "UNDER_30K", "RURAL", "SMALL,MEDIUM"},
            {"D", "51,52,11,24,26,42,45,50", "", "anywhere", "NOT_SURE", "", "15000", "NOT_SURE", "NOT_SURE", "", ""},
            {"E", "5138", "NY", "state", "NOT_SURE", "", "30000", "PREFER_NOT_TO_SAY", "ABOVE_110K", "SUBURBAN", ""},
        };
        StringBuilder out = new StringBuilder("{\"colleges\":[");
        for (int i = 0; i < pick.size(); i++) out.append(i > 0 ? "," : "").append(q(pick.get(i).unitId));
        out.append("],\"results\":{");
        boolean first = true;
        for (String[] k : profiles) {
            StudentProfile s = new StudentProfile();
            List<Program> ps = new ArrayList<>();
            for (String f : k[1].split(",")) if (!f.isEmpty()) ps.add(f.length() == 2 ? Program.family(f, 0) : byCode.get(f));
            s.setPrograms(ps);
            if (!k[2].isEmpty()) s.setHomeState(k[2]);
            if (k[3].equals("state") && !k[2].isEmpty()) s.setPreferredStates(Set.of(k[2]));
            else s.setLocationScope(StudentProfile.LocationScope.ANY_STATE);
            s.setPathway(StudentProfile.Pathway.valueOf(k[4]));
            if (!k[5].isEmpty()) { String[] sat = k[5].split("/"); s.setSatScores(Integer.parseInt(sat[0]), Integer.parseInt(sat[1])); }
            if (!k[6].isEmpty()) s.setAnnualBudget(Integer.parseInt(k[6]));
            s.setAidEligibility(StudentProfile.AidEligibility.valueOf(k[7]));
            s.setIncomeBracket(StudentProfile.IncomeBracket.valueOf(k[8]));
            List<StudentProfile.CampusSetting> st = new ArrayList<>();
            for (String x : k[9].split(",")) if (!x.isEmpty()) st.add(StudentProfile.CampusSetting.valueOf(x));
            s.setSettings(st);
            List<StudentProfile.CollegeSize> sz = new ArrayList<>();
            for (String x : k[10].split(",")) if (!x.isEmpty()) sz.add(StudentProfile.CollegeSize.valueOf(x));
            s.setSizes(sz);
            NextStepGenerator gen = new NextStepGenerator();
            for (College c : pick) {
                CollegeRecommendation r = engine.evaluate(s, c);
                out.append(first ? "" : ",");
                first = false;
                out.append(q(k[0] + "|" + c.unitId)).append(":{\"program\":").append(res(r.program))
                   .append(",\"academic\":").append(res(r.academic)).append(",\"financial\":").append(res(r.financial))
                   .append(",\"social\":").append(res(r.social)).append(",\"reasons\":[");
                List<String> rs = r.reasons();
                for (int i = 0; i < rs.size(); i++) out.append(i > 0 ? "," : "").append(q(rs.get(i)));
                out.append("],\"steps\":[");
                List<String> st2 = gen.collegeSteps(s, r);
                for (int i = 0; i < st2.size(); i++) out.append(i > 0 ? "," : "").append(q(st2.get(i)));
                out.append("]}");
            }
        }
        out.append("}}");
        System.out.println(out);
    }
}

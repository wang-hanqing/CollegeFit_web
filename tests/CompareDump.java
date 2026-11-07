import java.nio.file.*;
import java.util.*;

/** Dumps Compare results (summary and markers) for several profiles and college sets. */
public class CompareDump {
    static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
    public static void main(String[] a) throws Exception {
        Path data = Paths.get("/home/claude/JAVA_CollegeFit/data/processed");
        List<College> colleges = CollegeDataLoader.load(data.resolve("colleges.csv"), data.resolve("programs.csv"));
        List<Program> programs = CollegeDataLoader.loadProgramList(data.resolve("programs.csv"), colleges);
        Map<String, Program> byCode = new HashMap<>();
        for (Program p : programs) byCode.put(p.cipCode, p);
        Map<String, College> byId = new HashMap<>();
        for (College c : colleges) byId.put(c.unitId, c);
        RecommendationEngine engine = new RecommendationEngine();

        String[][] profiles = {
            {"A", "51,52", "NY", "state", "NOT_SURE", "COSTS,ADMISSION", "", ""},
            {"B", "5138,11", "NY", "anywhere", "BACHELOR", "GRADUATION,STUDY", "URBAN", "LARGE"},
            {"C", "", "CA", "state", "ASSOCIATE", "", "RURAL", ""},
            {"D", "52", "", "anywhere", "NOT_SURE", "CAMPUS,COSTS,GRADUATION", "SUBURBAN", "SMALL,MEDIUM"},
        };
        // college sets: top results of each profile mixed with fixed picks
        String[] fixed = {"190521", "190530", "166027", "190150", "196079", "110635", "193900", "190664", "204796"};
        StringBuilder out = new StringBuilder("{");
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
            List<StudentProfile.Priority> pr = new ArrayList<>();
            for (String p : k[5].split(",")) if (!p.isEmpty()) pr.add(StudentProfile.Priority.valueOf(p));
            s.setPriorities(pr);
            List<StudentProfile.CampusSetting> st = new ArrayList<>();
            for (String x : k[6].split(",")) if (!x.isEmpty()) st.add(StudentProfile.CampusSetting.valueOf(x));
            s.setSettings(st);
            List<StudentProfile.CollegeSize> sz = new ArrayList<>();
            for (String x : k[7].split(",")) if (!x.isEmpty()) sz.add(StudentProfile.CollegeSize.valueOf(x));
            s.setSizes(sz);
            List<CollegeRecommendation> ranked = engine.recommend(s, colleges);
            List<List<String>> sets = new ArrayList<>();
            for (int i = 0; i + 2 < Math.min(ranked.size(), 30); i += 3)
                sets.add(List.of(ranked.get(i).college.unitId, ranked.get(i + 1).college.unitId, ranked.get(i + 2).college.unitId));
            for (int i = 0; i + 1 < fixed.length; i++) sets.add(List.of(fixed[i], fixed[i + 1]));
            for (int i = 0; i + 2 < fixed.length; i += 2) sets.add(List.of(fixed[i], fixed[i + 1], fixed[i + 2]));
            for (List<String> set : sets) {
                List<College> cs = new ArrayList<>();
                for (String id : set) cs.add(byId.get(id));
                List<CollegeRecommendation> recs = engine.recommendAll(s, cs);
                Comparison cmp = new Comparison(s, recs);
                out.append(first ? "" : ",");
                first = false;
                out.append(q(k[0] + "|" + String.join(",", set))).append(":{\"summary\":[");
                for (int i = 0; i < cmp.summary().size(); i++) out.append(i > 0 ? "," : "").append(q(cmp.summary().get(i)));
                out.append("],\"different\":").append(cmp.differentDegrees()).append(",\"markers\":[");
                for (int i = 0; i < recs.size(); i++) {
                    out.append(i > 0 ? "," : "").append("{");
                    boolean f2 = true;
                    for (Comparison.Row row : Comparison.Row.values()) {
                        String m = cmp.marker(recs.get(i), row);
                        if (m == null) continue;
                        out.append(f2 ? "" : ",").append(q(row.name())).append(":").append(q(m));
                        f2 = false;
                    }
                    out.append("}");
                }
                out.append("],\"degrees\":[");
                for (int i = 0; i < recs.size(); i++) out.append(i > 0 ? "," : "").append(q(Comparison.degreeText(s, recs.get(i))));
                out.append("]}");
            }
        }
        System.out.println(out.append("}"));
    }
}

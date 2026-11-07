import java.nio.file.*;
import java.util.*;

public class DirectionsDump {
    public static void main(String[] a) throws Exception {
        Path data = Paths.get("/home/claude/JAVA_CollegeFit/data/processed");
        List<College> colleges = CollegeDataLoader.load(data.resolve("colleges.csv"), data.resolve("programs.csv"));
        CollegeDataLoader.loadProgramList(data.resolve("programs.csv"), colleges);
        InterestLinks links = InterestLinks.load(CollegeDataLoader.file(data.resolve("interest_links.csv")));
        StringBuilder out = new StringBuilder("{");
        out.append("\"collegeCount\":").append(colleges.size()).append(",\"fields\":{");
        String[][] combos = {{"I","C"},{"R"},{"A","S"},{"E"},{"S"},{"R","I"}};
        String[][] stateSets = {{"NY"},{},{"CA"},{"TX"}};
        boolean first = true;
        for (String[] combo : combos) for (String[] st : stateSets) {
            Set<InterestLinks.Interest> in = new LinkedHashSet<>();
            for (String s : combo) in.add(InterestLinks.Interest.valueOf(s));
            Set<String> states = new HashSet<>(Arrays.asList(st));
            if (!first) out.append(","); first = false;
            out.append("\"").append(String.join("", combo)).append("|").append(String.join(",", st)).append("\":[");
            boolean f1 = true;
            for (InterestLinks.FieldMatch m : links.fields(in, colleges, states)) {
                if (!f1) out.append(","); f1 = false;
                out.append("{\"family\":\"").append(m.family).append("\",\"colleges\":").append(m.colleges)
                   .append(",\"linkedCareers\":").append(m.linkedCareers).append(",\"careers\":[");
                boolean f2 = true;
                for (InterestLinks.CareerLink k : m.careers) { if (!f2) out.append(","); f2 = false; out.append("\"").append(k.soc).append("\""); }
                out.append("],\"programs\":[");
                f2 = true;
                for (String[] p : m.programs) { if (!f2) out.append(","); f2 = false; out.append("[\"").append(p[0].replace("\"","\\\"")).append("\",").append(p[1]).append("]"); }
                out.append("]}");
            }
            out.append("]");
        }
        out.append("},\"common\":{");
        first = true;
        String[] fam = {"52","51","11","50","24","26","42","45"};
        for (String[] st : stateSets) {
            Set<String> states = new HashSet<>(Arrays.asList(st));
            if (!first) out.append(","); first = false;
            out.append("\"").append(String.join(",", st)).append("\":[");
            for (int i = 0; i < fam.length; i++) { if (i > 0) out.append(","); out.append(RecommendationEngine.fieldCount(colleges, states, fam[i])); }
            out.append("]");
        }
        out.append("},\"pathway\":{");
        first = true;
        for (String[] st : stateSets) {
            Set<String> states = new HashSet<>(Arrays.asList(st));
            Map<RecommendationEngine.PathwayKind, int[]> p = RecommendationEngine.pathwaySummary(colleges, states);
            if (!first) out.append(","); first = false;
            out.append("\"").append(String.join(",", st)).append("\":[");
            boolean f1 = true;
            for (RecommendationEngine.PathwayKind k : RecommendationEngine.PathwayKind.values()) {
                if (!f1) out.append(","); f1 = false;
                out.append("[").append(p.get(k)[0]).append(",").append(p.get(k)[1]).append("]");
            }
            out.append("]");
        }
        out.append("}}");
        System.out.println(out);
    }
}

import java.nio.file.*;
import java.util.*;

/** Dumps the program search list (order, names, national college counts) and per-state counts. */
public class ProgramListDump {
    static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
    public static void main(String[] a) throws Exception {
        Path data = Paths.get("/home/claude/JAVA_CollegeFit/data/processed");
        List<College> colleges = CollegeDataLoader.load(data.resolve("colleges.csv"), data.resolve("programs.csv"));
        List<Program> programs = CollegeDataLoader.loadProgramList(data.resolve("programs.csv"), colleges);
        StringBuilder out = new StringBuilder("{\"list\":[");
        for (int i = 0; i < programs.size(); i++) {
            Program p = programs.get(i);
            out.append(i > 0 ? "," : "").append("[").append(q(p.cipCode)).append(",").append(q(p.fullName)).append(",").append(q(p.shortName())).append(",").append(p.collegeCount).append("]");
        }
        out.append("],\"counts\":{");
        String[][] sets = {{"NY"}, {"NY", "NJ"}, {"CA", "TX", "FL"}};
        for (int i = 0; i < sets.length; i++) {
            Map<String, Integer> c = RecommendationEngine.programCounts(colleges, new HashSet<>(Arrays.asList(sets[i])));
            out.append(i > 0 ? "," : "").append(q(String.join(",", sets[i]))).append(":{");
            boolean f = true;
            for (Map.Entry<String, Integer> e : new TreeMap<>(c).entrySet()) { out.append(f ? "" : ",").append(q(e.getKey())).append(":").append(e.getValue()); f = false; }
            out.append("}");
        }
        System.out.println(out.append("}}"));
    }
}

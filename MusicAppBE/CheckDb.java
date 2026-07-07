import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class CheckDb {
    public static void main(String[] args) {
        String url = "jdbc:sqlite:musicapp.db";
        try (Connection conn = DriverManager.getConnection(url);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT telegram_chat_id FROM music_library WHERE telegram_chat_id IS NOT NULL LIMIT 1")) {
            
            if (rs.next()) {
                System.out.println("CHAT_ID=" + rs.getString("telegram_chat_id"));
            } else {
                System.out.println("NO_CHAT_ID");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

import org.gagravarr.opus.OpusFile;
import org.gagravarr.opus.OpusTags;
import java.io.File;

public class TestOpus {
    public static void main(String[] args) throws Exception {
        OpusFile of = new OpusFile(new File("sample4.opus"));
        OpusTags tags = of.getTags();
        System.out.println("Title: " + tags.getTitle());
        System.out.println("Artist: " + tags.getArtist());
        System.out.println("Album: " + tags.getAlbum());
        System.out.println("Genre: " + tags.getGenre());
        System.out.println("Comments LYRICS: " + tags.getComments("LYRICS"));
    }
}

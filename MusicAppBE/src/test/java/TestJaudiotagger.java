import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;

public class TestJaudiotagger {
    public static void main(String[] args) throws Exception {
        java.io.File file = new java.io.File("sample4.opus");
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            System.out.println("Read opus: " + audioFile);
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        java.io.File file2 = new java.io.File("sample4.ogg");
        java.nio.file.Files.copy(file.toPath(), file2.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        try {
            AudioFile audioFile = AudioFileIO.read(file2);
            System.out.println("Read ogg: " + audioFile);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

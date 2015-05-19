package no.nmdc.ui.test.server;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 19.05.2015
 */
public class ErrorMessage {
    public String id;
    public long time;
    public String message;
    public String details;

    public ErrorMessage(String aId, long aTime, String aMessage, String aDetails) {
        id = aId;
        time = aTime;
        message = aMessage;
        details = aDetails;
    }

    @Override
    public String toString() {
        return "ErrorMessage{" +
                "id='" + id + '\'' +
                ", time=" + time +
                ", message='" + message + '\'' +
                ", details='" + details + '\'' +
                '}';
    }
}

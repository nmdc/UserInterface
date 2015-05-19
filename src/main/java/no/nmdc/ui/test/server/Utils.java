package no.nmdc.ui.test.server;

import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 19.05.2015
 */
public class Utils {
    private Utils() {
    }

    public static String stackTraceToString(Throwable aThrowable) {
        StringWriter stringWriter = new StringWriter();
        try (PrintWriter printWriter = new PrintWriter(stringWriter)) {
            aThrowable.printStackTrace(printWriter);
        }
        return stringWriter.toString();
    }
}

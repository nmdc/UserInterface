package no.nmdc.ui.test.server;

import javax.ws.rs.NotFoundException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;
import java.io.FileNotFoundException;
import java.nio.file.NoSuchFileException;
import java.util.Random;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 19.05.2015
 */
@Provider
public class ErrorMessageExceptionMapper implements ExceptionMapper<Exception> {
    private final Random random = new Random();

    public ErrorMessageExceptionMapper() {
    }

    @Override
    public Response toResponse(Exception exception) {
        String id = "#" + random.nextInt(1000_000);
        String message = exception.getMessage() != null ? exception.getMessage() : "An error has occurred";

        return Response.status(getResponseStatus(exception))
                .entity(new ErrorMessage(id, System.currentTimeMillis(), message, Utils.stackTraceToString(exception)))
                .type(MediaType.APPLICATION_JSON)
                .build();
    }

    private static Response.Status getResponseStatus(Exception aException) {
        if (aException instanceof NotFoundException ||
                aException instanceof NoSuchFileException ||
                aException instanceof FileNotFoundException) {
            return Response.Status.NOT_FOUND;
        }
        return Response.Status.BAD_REQUEST;
    }
}

package no.nmdc.ui.test.server;

import com.google.common.io.ByteStreams;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 24.04.2015
 */
@Path("/")
public class LocalFilesResource {
    private final java.nio.file.Path directory;

    public LocalFilesResource(java.nio.file.Path aDirectory) {
        directory = aDirectory;
    }

    @GET
    @Path("{request}")
    @Produces(MediaType.APPLICATION_JSON)
    public StreamingOutput getTotalDistance(@PathParam("request") final String aRequest) throws InterruptedException {
        if (aRequest.equals("search")) Thread.sleep(1000); // Simulate server response time
        return new StreamingOutput() {
            @Override
            public void write(OutputStream out) throws IOException, WebApplicationException {
                try (InputStream in = Files.newInputStream(directory.resolve(aRequest + ".json"))) {
                    ByteStreams.copy(in, out);
                }
            }
        };
    }
}

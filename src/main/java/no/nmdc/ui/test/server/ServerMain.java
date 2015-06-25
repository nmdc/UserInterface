package no.nmdc.ui.test.server;

import org.glassfish.grizzly.http.server.HttpServer;
import org.glassfish.grizzly.http.server.NetworkListener;
import org.glassfish.grizzly.http.server.StaticHttpHandler;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;

import java.awt.*;
import java.io.IOException;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Collections;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 24.04.2015
 */
public class ServerMain {
    public static void main(String[] args) throws IOException {
        Path filesDir = Paths.get("files").toAbsolutePath();
        Path webAppDir = Paths.get("src/main/webapp").toAbsolutePath();
        if (!Files.exists(webAppDir)) throw new IOException("Cannot find web app dir " + webAppDir);

        URI uri = URI.create("http://localhost:8080/");

        String serverUrl = System.getProperty("no.nmdc.server.url");
        Object resource = serverUrl != null ? new RemoteServerResource(serverUrl) : new LocalFilesResource(filesDir);

        HttpServer httpServer = GrizzlyHttpServerFactory.createHttpServer(uri.resolve(RemoteServerResource.API_PATH), new JaxRsApplication(resource));
        addNetworkListenersToLocalAddresses(httpServer, uri.getPort());
        httpServer.getServerConfiguration().addHttpHandler(new StaticHttpHandler(webAppDir.toString()), "/");
        httpServer.getListeners().forEach(listener -> listener.getFileCache().setEnabled(false));

        System.err.println();
        System.err.println("Web app dir: " + webAppDir);
        System.err.println(serverUrl != null ? "Using remote server: " + serverUrl : "Using local files: " + filesDir);
        System.err.println("Server started at " + uri);
        System.err.println("Press Enter to stop.");
        System.err.println();

        if (Arrays.asList(args).contains("-browse")) Desktop.getDesktop().browse(uri);

        while (true) {
            int b = System.in.read();
            if (b == '\n' || b == -1) break;
        }

        System.err.println("Stopping server");
        httpServer.shutdownNow();
    }

    private static void addNetworkListenersToLocalAddresses(HttpServer aHttpServer, int aPort) throws SocketException {
        Collections.list(NetworkInterface.getNetworkInterfaces()).stream()
                .flatMap(networkInterface -> Collections.list(networkInterface.getInetAddresses()).stream())
                .filter(inetAddress -> !inetAddress.isLoopbackAddress())
                .map(inetAddress -> new NetworkListener("grizzly_" + inetAddress.getHostAddress(), inetAddress.getHostAddress(), aPort))
                .forEach(aHttpServer::addListener);
    }
}

package no.nmdc.ui.controller;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.MalformedURLException;
import java.net.URL;
import javax.servlet.http.HttpServletRequest;
import org.apache.commons.io.IOUtils;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 *
 * @author Terry Hannant <a5119>
 */
@Controller
public class ProxyController {
   
    private static final org.slf4j.Logger LOG = LoggerFactory.getLogger(ProxyController.class);
 
    @Autowired
    String nmdcApiUrl;
    
    
    @RequestMapping("/metadata-api/{endpoint}")
    public void metadataProxy(HttpServletRequest request, OutputStream outstream,@PathVariable(value="endpoint") String endpoint) throws IOException {
    //Simple GET only proxy
        try {
            
            if(request.getQueryString() != null){
                endpoint = endpoint+"?"+request.getQueryString();
            }
            
            URL url = new URL(nmdcApiUrl+"metadata-api/"+endpoint);
            InputStream in = url.openStream();
            IOUtils.copy(in, outstream);
           
            
        } catch (MalformedURLException ex) {
           LOG.error("Error in proxy",ex);
        }
    }
   
        
}

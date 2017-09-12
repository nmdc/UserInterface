package no.nmdc.ui.conf;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.core.env.Environment;

/**
 *
 * @author Terry Hannant <a5119>
 */
@Configuration
@PropertySource("file:${catalina.base}/conf/nmdcUserInterface.properties")

public class ApplicationConfig {

    @Autowired
    private Environment env;
    
    
    @Bean
    public String getNmdcApiUrl()
    {
        return env.getProperty("nmdc.api.url");
    }
    
    
}

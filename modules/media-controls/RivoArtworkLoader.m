#import "RivoArtworkLoader.h"

static NSCache<NSString *, UIImage *> *sArtworkCache = nil;

@implementation RivoArtworkLoader

+ (void)initialize {
    if (self == [RivoArtworkLoader class]) {
        sArtworkCache = [[NSCache alloc] init];
        sArtworkCache.countLimit = 50;
    }
}

+ (UIImage *)cachedImageForSource:(NSString *)source {
    if (!source || source.length == 0) return nil;
    return [sArtworkCache objectForKey:source];
}

+ (void)loadImageWithSource:(NSString *)source completion:(void (^)(UIImage * _Nullable image))completion {
    if (!source || source.length == 0) {
        if (completion) completion(nil);
        return;
    }

    UIImage *cached = [sArtworkCache objectForKey:source];
    if (cached) {
        if (completion) completion(cached);
        return;
    }

    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        UIImage *loaded = [self decodeImageFromSource:source];
        if (loaded) {
            [sArtworkCache setObject:loaded forKey:source];
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            if (completion) completion(loaded);
        });
    });
}

+ (UIImage *)decodeImageFromSource:(NSString *)source {
    if ([source hasPrefix:@"data:"]) {
        NSRange commaRange = [source rangeOfString:@","];
        if (commaRange.location != NSNotFound) {
            NSString *base64Str = [source substringFromIndex:commaRange.location + 1];
            NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Str
                                                               options:NSDataBase64DecodingIgnoreUnknownCharacters];
            if (data && data.length > 0) {
                return [UIImage imageWithData:data];
            }
        }
        return nil;
    }

    NSString *filePath = nil;
    if ([source hasPrefix:@"file://"]) {
        NSURL *url = [NSURL URLWithString:source];
        filePath = [url path] ?: [source substringFromIndex:7];
    } else if ([source hasPrefix:@"/var/"] || [source hasPrefix:@"/private/var/"] || [source hasPrefix:@"/Users/"]) {
        filePath = source;
    }

    if (filePath && filePath.length > 0) {
        if ([[NSFileManager defaultManager] fileExistsAtPath:filePath]) {
            NSData *data = [NSData dataWithContentsOfFile:filePath];
            if (data && data.length > 0) {
                return [UIImage imageWithData:data];
            }
        }
    }

    NSString *remoteUrl = source;
    if ([remoteUrl hasPrefix:@"//"]) {
        remoteUrl = [@"https:" stringByAppendingString:remoteUrl];
    } else if ([remoteUrl hasPrefix:@"/"]) {
        remoteUrl = [@"https://rivo-m.duckdns.org" stringByAppendingString:remoteUrl];
    } else if ([remoteUrl hasPrefix:@"http://"]) {
        remoteUrl = [@"https://" stringByAppendingString:[remoteUrl substringFromIndex:7]];
    }

    if ([remoteUrl hasPrefix:@"https://"]) {
        NSString *encoded = [remoteUrl stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]];
        NSURL *url = [NSURL URLWithString:encoded ?: remoteUrl];
        if (url) {
            NSData *data = [NSData dataWithContentsOfURL:url options:NSDataReadingUncached error:nil];
            if (data && data.length > 0) {
                return [UIImage imageWithData:data];
            }
        }
    }

    return nil;
}

@end

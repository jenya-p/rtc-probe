CREATE TABLE IF NOT EXISTS `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `sid` varchar(128) NOT NULL,
  `type` varchar(245) NOT NULL,
  `data` text NOT NULL,
  `from` varchar(22) DEFAULT NULL,
  `usable` int(2) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`),
  KEY `from` (`from`),
  KEY `sid` (`sid`)
) ENGINE=MyISAM AUTO_INCREMENT=5517 DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `streams` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `created` int(11) NOT NULL,
  `accessed` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=299 DEFAULT CHARSET=utf8;

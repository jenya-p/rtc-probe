<?php

header('Content-Type: application/json');

$action = $_REQUEST['action'];
$from = $_REQUEST['from'];
$uid  = $_REQUEST['uid'];
$sids = $_REQUEST['sids'];
if(!is_array($sids)){
	$sids = [$sids];
}

$db = new DB();

$return = [];


if( $action == 'start'){
	$return['uid'] = $db->startStream($_REQUEST['name']);
} else if( $action == 'stop'){
	$db->update('streams', $uid, ['active' => 0]);
	$db->delete('messages', ['uid' => $uid]);
} else if ( $action == 'list' ) {
	$return['list'] = $db->list();
} else if($_SERVER['REQUEST_METHOD'] == 'POST'){
	$data = json_decode($_POST['data'], true);
	if($data){
		foreach ($data as $message){
			$db->insert('messages',
				[	'uid' => $message['uid'],
					'sid' => $message['sid'],
					'type' => $message['type'],
					'from' => $from,
					'data' => $message['data']]);
		}
	}
}

$data = [];
foreach ($sids as $sid){
	if($from == 1){
		$db->update('streams', ['id' => $uid], ['active' => 1, 'accessed' => time()]);
		$data += $db->getMessagesBySid('2', $sid);
	} else {
		$data += $db->getMessagesBySid('1', $sid);
	}
}
if($data){
	$return += ['messages' => $data];
}

echo json_encode($return); die;



class DB {
	var $connection;


	public function __construct() {
		$conf = require_once ('config.php');
		$this->connection = new PDO($conf['dsn'], $conf['user'], $conf['password']);
	}

	function select($sql, $data){
		$query = $this->connection->prepare($sql);
		$params = [];
		foreach ($data as $key => $value){
			$params[':'.$key] = $value;
		}
		$query->execute($params);
		return $query->fetchAll(PDO::FETCH_ASSOC);
	}

	public function selectOne($sql, $data){
		$ret = $this->select($sql, $data);
		if(!empty($ret)){
			return $ret[0][array_keys($ret[0])[0]];
		}
	}

	function insert($table, $data) {
		$keys = array_keys($data);
		$sql = "INSERT INTO `".$table."` (".
			implode(' ,', array_map(function($item) {return '`'.$item.'`';} , $keys)).
			") VALUES (".
			implode(' ,', array_map(function($item) {return ':'.$item.'';} , $keys)).
			")";
		$params = [];
		foreach ($data as $key => $value){
			$params[':'.$key] = $value;
		}
		$query = $this->connection->prepare($sql);
		if ($query->execute($params) === false) {
			print_r($this->connection->errorInfo()); die;
		};
		return $this->connection->lastInsertId($table);
	}

	function update($table, $where, $data){
		$keys = array_keys($data);
		$sql = "UPDATE `".$table."` SET ".
			implode(' ,', array_map(function($item) {return '`'.$item.'` = :'.$item;} , $keys))." ";

		$params = [];
		if(is_scalar($where)) {
			$where = ['id' => $where];
		}
		if(!empty($where)){
			$sql .= ' WHERE '.
				implode(' AND ', array_map(function($item) {return '`'.$item.'` = :'.$item;} , array_keys($where)));
			$data = $data + $where;
		}
		foreach ($data as $key => $value){
			$params[':'.$key] = $value;
		}
		$query = $this->connection->prepare($sql);
		if ($query->execute($params) === false) {
			print_r($query->errorInfo()); die;
		};
		$query->rowCount();;
	}

	public function delete($table, $where){
		$sql = "DELETE FROM `".$table."`";
		$params = [];
		if(is_scalar($where)) {
			$where = ['id' => $where];
		}
		$sql .= ' WHERE '.
			implode(" AND ", array_map(function($item) {return "`".$item."` = :".$item;} , array_keys($where)));
		foreach ($where as $key => $value){
			$params[":".$key] = $value;
		}
		$query = $this->connection->prepare($sql);
		if ($query->execute($params) === false) {
			print_r($query->errorInfo()); die;
		};
		$query->rowCount();
	}

	// Прикладное:

	function getStreams(){
		$returns = [];
		$data = $this->connection
			->query("SELECT * FROM streams WHERE active = 1")
			->fetchAll(PDO::FETCH_ASSOC);

		return $returns;
	}

	public function startStream($name){
		$time = time();
		return $this->insert('streams', ['name' => $name, 'created' => $time, 'accessed' => $time]);
	}

	public function closeStream($uid){
		$this->update('streams', $uid, ['active' => 0]);
		$this->delete('messages', ['uid' => $uid]);
	}


	public function getMessagesBySid($from, $sid){
		$sql = "SELECT * FROM `messages` WHERE `sid` = :sid AND `from` = :from order by `type` = \"offer\" DESC, `type` = \"answer\" DESC, `id` asc";
		$where = [
			'from' => $from,
			'sid' => $sid
		];
		$rows = $this->select($sql, $where);

		$this->delete('messages', $where);

		return $rows;
	}

	public function list(){
		$time = time() - 40;
		$actives = $this->select('SELECT * FROM `streams` WHERE active = 1 AND accessed > :time order by id desc', ['time' => $time]);
		$inactives = $this->select('SELECT * FROM `streams` WHERE active = 0 OR accessed < :time order by id desc limit 50', ['time' => $time]);
		foreach ($actives as &$stream){
			$stream['sid'] = $sid = $this->selectOne("SELECT sid FROM messages m WHERE uid = :uid AND m.`type` = 'offer' AND m.`from` = 1 LIMIT 1", ['uid' => $stream['id']]);
			$stream['messages'] = $this->getMessagesBySid(1, $sid);
		}
		foreach ($inactives as &$inactiveItem){
			if($inactiveItem['active'] == 1){
				$this->update('streams', $inactiveItem['id'], ['active' => 0]);
				$inactiveItem['active'] = 0;
			}
			if(is_file(__DIR__.DIRECTORY_SEPARATOR.'upload'.DIRECTORY_SEPARATOR.$inactiveItem['id'].DIRECTORY_SEPARATOR.'camera.webm')){
				$inactiveItem['cameraUrl'] = '/upload/'.$inactiveItem['id'].'/camera.webm';
			}
			if(is_file(__DIR__.DIRECTORY_SEPARATOR.'upload'.DIRECTORY_SEPARATOR.$inactiveItem['id'].DIRECTORY_SEPARATOR.'screen.webm')){
				$inactiveItem['screenUrl'] = '/upload/'.$inactiveItem['id'].'/screen.webm';
			}
		}
		$return = $actives + $inactives;
		foreach ($return as &$item){
			$item['createdText'] = date('d.m.Y H:i', $item['created']);
			$item['accessedText'] = date('d.m.Y H:i', $item['accessed']);
		}
		return $return;
	}



}
